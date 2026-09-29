import { expect, test, type Browser, type Locator, type Page } from "@playwright/test"

import {
    EASING_FUNCTION_ARRAY_CASE,
    ORCHESTRATION_CASES,
    PRESENCE_CASES,
    TRANSFORM_TEMPLATE_CASE,
} from "../src/conformance/cases.js"

/**
 * Manifest cases that render in an isolated `conformanceMode`. Each test
 * opens the same scene in Lynx for Web and in the locked Web reference, and
 * asserts computed semantic values in both.
 */

const previewUrl = "/__web_preview?casename=main.web.bundle"
const INFRA_NOISE = [
    "net::ERR_CONNECTION_RESET",
    "[webpack-dev-server]",
    "[rspeedy-dev-server]",
]

async function openCase(browser: Browser, mode: string) {
    const lynxPage = await browser.newPage()
    const webPage = await browser.newPage()
    const errors: string[] = []
    for (const page of [lynxPage, webPage]) {
        page.on("pageerror", (error) => errors.push(error.message))
        page.on("console", (message) => {
            const text = message.text()
            if (
                message.type() === "error" &&
                !INFRA_NOISE.some((marker) => text.includes(marker))
            ) {
                errors.push(text)
            }
        })
    }
    await lynxPage.addInitScript((conformanceMode) => {
        localStorage.setItem(
            "lynx-web-core-global-props",
            JSON.stringify({ conformanceMode })
        )
    }, mode)
    await Promise.all([
        lynxPage.goto(`http://localhost:3000${previewUrl}`),
        webPage.goto(`http://localhost:4173/?mode=baseline&case=${mode}`),
    ])
    // Lynx for Web hydrates main-thread refs after first paint; interacting
    // earlier drops the event.
    await expect(
        lynxPage.locator('[has-react-ref="true"]').first()
    ).toBeAttached()
    await lynxPage.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
    )
    return {
        renderers: [
            ["Lynx", lynxPage],
            ["Web", webPage],
        ] as const satisfies readonly (readonly [string, Page])[],
        errors,
        close: () => Promise.all([lynxPage.close(), webPage.close()]),
    }
}

const translate = (target: Locator) =>
    target.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return { x: Number(matrix.m41.toFixed(2)), y: Number(matrix.m42.toFixed(2)) }
    })

test("manifest case: easing callbacks shape each keyframe segment", async ({
    browser,
}) => {
    const expected = EASING_FUNCTION_ARRAY_CASE.expected
    const scene = await openCase(browser, "easing-function-array")

    for (const [renderer, page] of scene.renderers) {
        const example = page.locator("#example-easing-function-array")
        const target = page.locator("#target-easing-function-array")
        await expect
            .poll(async () => (await translate(target)).x)
            .toBe(expected.startX)

        // Sample from the click itself so both renderers share a time base.
        const sampling = target.evaluate(
            (element, total) =>
                new Promise<[number, number][]>((resolve) => {
                    const samples: [number, number][] = []
                    document.addEventListener(
                        "click",
                        () => {
                            const startedAt = performance.now()
                            const sample = () => {
                                const elapsed = performance.now() - startedAt
                                samples.push([
                                    elapsed,
                                    new DOMMatrixReadOnly(
                                        getComputedStyle(element).transform
                                    ).m41,
                                ])
                                elapsed > total
                                    ? resolve(samples)
                                    : requestAnimationFrame(sample)
                            }
                            sample()
                        },
                        { capture: true, once: true }
                    )
                }),
            expected.durationMs + 800
        )
        await example.click()
        const samples = await sampling

        // The first segment holds x at its start keyframe, so the first frame
        // that moves marks the second segment's start. Latency can only
        // delay it, never bring it forward.
        const moving = samples.findIndex(
            ([, x]) => Math.abs(x - expected.startX) >= 0.5
        )
        expect(moving, `${renderer} animation reached segment two`).toBeGreaterThan(0)
        const [secondSegmentStart] = samples[moving]!
        expect(
            secondSegmentStart,
            `${renderer} first segment holds: ${JSON.stringify(samples[moving])}`
        ).toBeGreaterThanOrEqual(expected.holdUntilMs)
        const halfSegment = expected.durationMs / 4
        const [, secondSegmentX] = samples.reduce((closest, current) =>
            Math.abs(current[0] - secondSegmentStart - halfSegment) <
            Math.abs(closest[0] - secondSegmentStart - halfSegment)
                ? current
                : closest
        )
        expect(
            secondSegmentX,
            `${renderer} ease-in second segment trails linear`
        ).toBeGreaterThanOrEqual(expected.secondSegmentMinX)
        expect(secondSegmentX).toBeLessThanOrEqual(expected.secondSegmentMaxX)
        await expect
            .poll(async () => (await translate(target)).x)
            .toBe(expected.endX)
        await expect(
            page.locator("#easing-function-array-calls"),
            `${renderer} ${EASING_FUNCTION_ARRAY_CASE.upstream.testName}`
        ).toHaveText("first:true second:true")
    }

    expect(scene.errors).toEqual([])
    await scene.close()
})

test("manifest case: transformTemplate composes the generated transform", async ({
    browser,
}) => {
    const expected = TRANSFORM_TEMPLATE_CASE.expected
    const scene = await openCase(browser, "transform-template")

    for (const [renderer, page] of scene.renderers) {
        await expect
            .poll(() => translate(page.locator("#target-transform-template")), {
                message: `${renderer} ${TRANSFORM_TEMPLATE_CASE.upstream.testName}`,
            })
            .toEqual({ x: expected.targetX, y: expected.targetX })
        await expect
            .poll(
                () =>
                    translate(page.locator("#target-transform-template-computed")),
                { message: `${renderer} main-thread template` }
            )
            .toEqual({ x: expected.computedX, y: 0 })
    }

    expect(scene.errors).toEqual([])
    await scene.close()
})

const opacity = (target: Locator) =>
    target.evaluate((element) => Number(getComputedStyle(element).opacity))

/**
 * Sample opacity on every frame from the click on `trigger` until `target`
 * leaves the tree.
 */
async function opacityUntilRemoved(trigger: Locator, target: Locator) {
    const samples = target.evaluate(
        (element) =>
            new Promise<number[]>((resolve) => {
                const values: number[] = []
                document.addEventListener(
                    "click",
                    () => {
                        const sample = () => {
                            if (!element.isConnected) {
                                resolve(values)
                                return
                            }
                            values.push(Number(getComputedStyle(element).opacity))
                            requestAnimationFrame(sample)
                        }
                        sample()
                    },
                    { capture: true, once: true }
                )
            })
    )
    await trigger.click()
    return samples
}

test.describe("AnimatePresence", () => {
    test("manifest case: a removed child exits before AnimatePresence releases it", async ({
        browser,
    }) => {
        const expected = PRESENCE_CASES.exit.expected
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-exit")
            await expect(target).toHaveCount(1)
            const samples = await opacityUntilRemoved(
                page.locator("#example-presence-exit"),
                target
            )
            expect(
                samples.some(
                    (value) =>
                        value > expected.minMidOpacity &&
                        value < expected.maxMidOpacity
                ),
                `${renderer} still mounted mid-exit: ${samples.slice(0, 3)}…${samples.slice(-3)}`
            ).toBe(true)
            expect(samples.at(-1)!, `${renderer} released after the exit`).toBeLessThan(
                expected.minMidOpacity
            )
            await expect(page.locator("#presence-exit-status")).toHaveText(
                "exit-complete:1"
            )
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: presence initial false skips the mount animation", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-initial-false")
            await expect(target).toHaveCount(1)
            // Sample every frame for a while: x must never be below target.
            const samples = await target.evaluate(
                (element) =>
                    new Promise<number[]>((resolve) => {
                        const values: number[] = []
                        const startedAt = performance.now()
                        const sample = () => {
                            values.push(
                                new DOMMatrixReadOnly(
                                    getComputedStyle(element).transform
                                ).m41
                            )
                            performance.now() - startedAt > 400
                                ? resolve(values)
                                : requestAnimationFrame(sample)
                        }
                        sample()
                    })
            )
            expect(
                samples.every(
                    (x) => x === PRESENCE_CASES.initialFalse.expected.x
                ),
                `${renderer} ${PRESENCE_CASES.initialFalse.upstream.testName}: ${samples.slice(0, 4)}`
            ).toBe(true)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: a child re-added while exiting animates back in", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-reenter")
            await expect.poll(() => opacity(target)).toBe(1)
            await page.locator("#example-presence-reenter").click()
            await page.waitForTimeout(
                PRESENCE_CASES.reenter.expected.reenterAfterMs + 700
            )
            await expect(target, `${renderer} never removed`).toHaveCount(1)
            await expect.poll(() => opacity(target)).toBe(1)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: mode wait renders one child at a time", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const items = page.locator('[id^="presence-wait-item-"]')
            await expect(items).toHaveCount(1)
            await page.locator("#example-presence-wait").click()
            await page.waitForTimeout(200)
            await expect(items, `${renderer} one child while exiting`).toHaveCount(1)
            await expect(page.locator("#presence-wait-item-0")).toHaveCount(1)
            await expect(
                page.locator(
                    `#presence-wait-item-${PRESENCE_CASES.wait.expected.latestIndex}`
                ),
                `${renderer} latest child after exit`
            ).toHaveCount(1, { timeout: 3_000 })
            await expect(items).toHaveCount(1)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: a child without exit is removed immediately", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const previous = page.locator("#presence-no-exit-item-0")
            await expect(previous).toHaveCount(1)
            // Time the removal in the page, from the click to disconnection.
            const removedAfter = previous.evaluate(
                (element) =>
                    new Promise<number>((resolve) => {
                        document.addEventListener(
                            "click",
                            () => {
                                const startedAt = performance.now()
                                const check = () =>
                                    element.isConnected
                                        ? requestAnimationFrame(check)
                                        : resolve(performance.now() - startedAt)
                                check()
                            },
                            { capture: true, once: true }
                        )
                    })
            )
            await page.locator("#example-presence-no-exit").click()
            expect(
                await removedAfter,
                `${renderer} removal does not wait for a transition`
            ).toBeLessThan(PRESENCE_CASES.noExit.expected.maxRemovalMs)
            await expect(page.locator("#presence-no-exit-item-1")).toHaveCount(1)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: exit variants use AnimatePresence custom", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-custom")
            await expect.poll(async () => (await translate(target)).x).toBe(0)
            // Track x until the child is released: custom=2 exits to 80,
            // while the element's own custom=1 would stop at 40.
            const peak = target.evaluate(
                (element) =>
                    new Promise<number>((resolve) => {
                        let maximum = 0
                        document.addEventListener(
                            "click",
                            () => {
                                const sample = () => {
                                    if (!element.isConnected) {
                                        resolve(maximum)
                                        return
                                    }
                                    maximum = Math.max(
                                        maximum,
                                        new DOMMatrixReadOnly(
                                            getComputedStyle(element).transform
                                        ).m41
                                    )
                                    requestAnimationFrame(sample)
                                }
                                sample()
                            },
                            { capture: true, once: true }
                        )
                    })
            )
            await page.locator("#example-presence-custom").click()
            expect(await peak, `${renderer} custom=2 exit target`).toBeGreaterThan(
                PRESENCE_CASES.custom.expected.maxX
            )
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: exit propagates through variants", async ({
        browser,
    }) => {
        const expected = PRESENCE_CASES.exitPropagation.expected
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-propagation")
            await expect.poll(() => opacity(target)).toBe(1)
            const samples = await opacityUntilRemoved(
                page.locator("#example-presence-propagation"),
                target
            )
            expect(
                samples.some((value) => value > 0 && value < expected.maxMidOpacity),
                `${renderer} grandchild follows the exit label: ${samples.slice(-4)}`
            ).toBe(true)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })
})

/**
 * Sample the opacity of several targets on every frame, starting from the
 * click on `trigger`, so both renderers share a time base.
 */
async function sampleOpacities(
    page: Page,
    trigger: Locator,
    ids: readonly string[],
    durationMs: number
) {
    const sampling = page.evaluate(
        ([targetIds, total]) =>
            new Promise<{ t: number; values: number[] }[]>((resolve) => {
                const find = (id: string): Element | null => {
                    const visit = (root: Document | ShadowRoot): Element | null => {
                        const found = root.getElementById?.(id) ?? root.querySelector(`#${id}`)
                        if (found) return found
                        for (const element of root.querySelectorAll("*")) {
                            if (element.shadowRoot) {
                                const nested = visit(element.shadowRoot)
                                if (nested) return nested
                            }
                        }
                        return null
                    }
                    return visit(document)
                }
                const elements = (targetIds as string[]).map(find)
                const samples: { t: number; values: number[] }[] = []
                document.addEventListener(
                    "click",
                    () => {
                        const startedAt = performance.now()
                        const sample = () => {
                            const t = performance.now() - startedAt
                            samples.push({
                                t,
                                values: elements.map((element) =>
                                    element
                                        ? Number(getComputedStyle(element).opacity)
                                        : Number.NaN
                                ),
                            })
                            t > (total as number)
                                ? resolve(samples)
                                : requestAnimationFrame(sample)
                        }
                        sample()
                    },
                    { capture: true, once: true }
                )
            }),
        [ids, durationMs] as const
    )
    await trigger.click()
    return sampling
}

/** The first time each target reaches `threshold`, in ms after the click. */
function firstReached(
    samples: { t: number; values: number[] }[],
    threshold: number
) {
    return samples[0]!.values.map((_, index) => {
        const hit = samples.find((sample) => sample.values[index]! >= threshold)
        return hit ? hit.t : Number.POSITIVE_INFINITY
    })
}

async function press(page: Page, isLynx: boolean, target: Locator) {
    await target.scrollIntoViewIfNeeded()
    await target.hover()
    const box = (await target.boundingBox())!
    if (isLynx) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
        })
        return async () => {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
            })
            await cdp.detach()
        }
    }
    await page.mouse.down()
    return () => page.mouse.up()
}

test.describe("variant orchestration", () => {
    const { staggerFunction } = ORCHESTRATION_CASES
    const { stepMs, hiddenOpacity, visibleOpacity } = staggerFunction.expected

    test("manifest case: afterChildren holds the parent until children finish", async ({
        browser,
    }) => {
        const { durationMs } = ORCHESTRATION_CASES.afterChildren.expected
        const scene = await openCase(browser, "orchestration")
        const ids = ["target-orch-after-parent", "target-orch-after-child"]
        for (const [renderer, page] of scene.renderers) {
            const example = page.locator("#example-orch-after-children")
            await expect
                .poll(() => opacity(page.locator("#target-orch-after-child")))
                .toBe(hiddenOpacity)
            for (const [from, to] of [
                [hiddenOpacity, visibleOpacity],
                [visibleOpacity, hiddenOpacity],
            ] as const) {
                const samples = await sampleOpacities(
                    page,
                    example,
                    ids,
                    durationMs * 3
                )
                const childMoving = samples.filter(
                    ({ values: [, child] }) => child !== from && child !== to
                )
                expect(childMoving.length, `${renderer} child animates`).toBeGreaterThan(0)
                expect(
                    childMoving.every(({ values: [parent] }) => parent === from),
                    `${renderer} ${ORCHESTRATION_CASES.afterChildren.upstream.testName}: parent waits for ${to}`
                ).toBe(true)
                await expect
                    .poll(
                        () =>
                            Promise.all(
                                ids.map((id) => opacity(page.locator(`#${id}`)))
                            ),
                        { message: `${renderer} both settle at ${to}`, timeout: 4_000 }
                    )
                    .toEqual([to, to])
            }
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: automatic-duration beforeChildren waits for the parent", async ({
        browser,
    }) => {
        const { settledX } = ORCHESTRATION_CASES.beforeChildrenAutomatic.expected
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            const parent = page.locator("#target-orch-before-parent")
            const child = page.locator("#target-orch-before-child")
            await expect.poll(() => opacity(child)).toBe(hiddenOpacity)
            await page.locator("#example-orch-before-children").click()
            // Poll until the child is revealed and record the parent position.
            let parentXAtReveal = Number.NaN
            await expect
                .poll(
                    async () => {
                        const childOpacity = await opacity(child)
                        if (childOpacity === visibleOpacity) {
                            parentXAtReveal = (await translate(parent)).x
                        } else {
                            expect((await translate(parent)).x >= 0).toBe(true)
                        }
                        return childOpacity
                    },
                    { timeout: 6_000, intervals: [16] }
                )
                .toBe(visibleOpacity)
            expect(
                parentXAtReveal,
                `${renderer} ${ORCHESTRATION_CASES.beforeChildrenAutomatic.upstream.testName}`
            ).toBeGreaterThanOrEqual(settledX)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    for (const [name, key, prefix] of [
        ["delayChildren: stagger() offsets children by index", "staggerFunction", "target-orch-stagger-function-"],
        ["staggerChildren offsets children by index", "staggerChildren", "target-orch-stagger-children-"],
    ] as const) {
        test(`manifest case: ${name}`, async ({ browser }) => {
            const scene = await openCase(browser, "orchestration")
            for (const [renderer, page] of scene.renderers) {
                const ids = [0, 1, 2].map((index) => `${prefix}${index}`)
                await expect.poll(() => opacity(page.locator(`#${ids[0]}`))).toBe(hiddenOpacity)
                const example = page.locator(
                    key === "staggerFunction"
                        ? "#example-orch-stagger-function"
                        : "#example-orch-stagger-children"
                )
                const samples = await sampleOpacities(page, example, ids, stepMs * 3 + 300)
                const reached = firstReached(samples, visibleOpacity)
                expect(reached.every(Number.isFinite), `${renderer} all revealed`).toBe(true)
                for (let index = 1; index < reached.length; index++) {
                    const gap = reached[index]! - reached[index - 1]!
                    expect(gap, `${renderer} ${ORCHESTRATION_CASES[key].upstream.testName} gap ${index}`).toBeGreaterThan(stepMs * 0.6)
                    expect(gap).toBeLessThan(stepMs * 1.4)
                }
            }
            expect(scene.errors).toEqual([])
            await scene.close()
        })
    }

    test("manifest case: components without variants are transparent to stagger order", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            const ids = [1, 2, 3, 4].map((index) => `target-orch-transparent-${index}`)
            await expect.poll(() => opacity(page.locator(`#${ids[0]}`))).toBe(hiddenOpacity)
            const samples = await sampleOpacities(
                page,
                page.locator("#example-orch-stagger-transparent"),
                ids,
                stepMs * 4 + 300
            )
            const reached = firstReached(samples, visibleOpacity)
            const order = [...reached.keys()].sort((a, b) => reached[a]! - reached[b]!)
            expect(order.map((index) => index + 1), `${renderer} reverse order`).toEqual([4, 3, 2, 1])
            for (let index = 1; index < order.length; index++) {
                const gap = reached[order[index]!]! - reached[order[index - 1]!]!
                expect(gap, `${renderer} equal stagger gap`).toBeGreaterThan(stepMs * 0.6)
                expect(gap).toBeLessThan(stepMs * 1.4)
            }
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })
})

test.describe("animation controls", () => {
    test("manifest case: controls.start propagates variants and resolves", async ({
        browser,
    }) => {
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            await page.locator("#example-orch-controls").click()
            await expect(page.locator("#orch-controls-status"), `${renderer} start() resolves`).toHaveText("resolved", { timeout: 4_000 })
            expect((await translate(page.locator("#target-orch-controls-parent"))).x).toBe(
                ORCHESTRATION_CASES.controlsStart.expected.x
            )
            expect(await opacity(page.locator("#target-orch-controls-child"))).toBe(1)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: controls.set jumps bound components", async ({
        browser,
    }) => {
        const { x } = ORCHESTRATION_CASES.controlsSet.expected
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            const targets = ["#target-orch-set-a", "#target-orch-set-b"].map((id) =>
                page.locator(id)
            )
            await page.locator("#example-orch-controls-set").click()
            for (const target of targets) {
                await expect.poll(async () => (await translate(target)).x, { message: renderer }).toBe(x)
            }
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })
})

test.describe("gesture variant propagation", () => {
    test("manifest case: a whileTap label applies and unapplies children", async ({
        browser,
    }) => {
        const { restOpacity, pressedOpacity } = ORCHESTRATION_CASES.tapPropagation.expected
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            const parent = page.locator("#target-orch-tap-parent")
            const child = page.locator("#target-orch-tap-child")
            await expect.poll(() => opacity(child)).toBe(restOpacity)
            const release = await press(page, renderer === "Lynx", parent)
            await expect.poll(() => opacity(child), { message: `${renderer} pressed` }).toBe(pressedOpacity)
            await release()
            await page.mouse.move(0, 0)
            await expect.poll(() => opacity(child), { message: `${renderer} released` }).toBe(restOpacity)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: a whileHover label propagates to children", async ({
        browser,
    }) => {
        const { restOpacity, hoveredOpacity } = ORCHESTRATION_CASES.hoverPropagation.expected
        const scene = await openCase(browser, "orchestration")
        for (const [renderer, page] of scene.renderers) {
            // Hover hit-testing in Lynx for Web uses layout rects that do not
            // track scrolling, so this card is rendered first to stay in view.
            const parent = page.locator("#target-orch-hover-parent")
            const child = page.locator("#target-orch-hover-child")
            await expect.poll(() => opacity(child)).toBe(restOpacity)
            await parent.hover()
            await expect.poll(() => opacity(child), { message: `${renderer} hovered` }).toBe(hoveredOpacity)
            await page.mouse.move(0, 0)
            await expect.poll(() => opacity(child), { message: `${renderer} left` }).toBe(restOpacity)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })
})
