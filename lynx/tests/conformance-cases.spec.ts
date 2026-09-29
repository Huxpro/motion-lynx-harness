import { expect, test, type Browser, type Locator, type Page } from "@playwright/test"

import {
    EASING_FUNCTION_ARRAY_CASE,
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
            expected.durationMs + 300
        )
        await example.click()
        const samples = await sampling

        const held = samples.filter(([elapsed]) => elapsed < expected.holdUntilMs)
        expect(
            held.every(([, x]) => Math.abs(x - expected.startX) < 0.5),
            `${renderer} first segment holds: ${JSON.stringify(held.slice(-3))}`
        ).toBe(true)
        const [, secondSegmentX] = samples.reduce((closest, current) =>
            Math.abs(current[0] - expected.secondSegmentSampleMs) <
            Math.abs(closest[0] - expected.secondSegmentSampleMs)
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

test.describe("AnimatePresence", () => {
    test("manifest case: a removed child exits before AnimatePresence releases it", async ({
        browser,
    }) => {
        const expected = PRESENCE_CASES.exit.expected
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-exit")
            await expect(target).toHaveCount(1)
            await page.locator("#example-presence-exit").click()
            await page.waitForTimeout(expected.midExitMs)
            await expect(target, `${renderer} still mounted mid-exit`).toHaveCount(1)
            const mid = await opacity(target)
            expect(mid, `${renderer} mid-exit opacity`).toBeGreaterThan(
                expected.minMidOpacity
            )
            expect(mid).toBeLessThan(expected.maxMidOpacity)
            await expect(target, `${renderer} released`).toHaveCount(0, {
                timeout: 3_000,
            })
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
            await expect(page.locator("#presence-no-exit-item-0")).toHaveCount(1)
            const startedAt = Date.now()
            await page.locator("#example-presence-no-exit").click()
            await expect(page.locator("#presence-no-exit-item-1")).toHaveCount(1)
            await expect(page.locator("#presence-no-exit-item-0")).toHaveCount(0)
            expect(
                Date.now() - startedAt,
                `${renderer} removal latency`
            ).toBeLessThan(PRESENCE_CASES.noExit.expected.maxRemovalMs + 500)
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })

    test("manifest case: exit variants use AnimatePresence custom", async ({
        browser,
    }) => {
        const expected = PRESENCE_CASES.custom.expected
        const scene = await openCase(browser, "presence")
        for (const [renderer, page] of scene.renderers) {
            const target = page.locator("#target-presence-custom")
            await expect.poll(async () => (await translate(target)).x).toBe(0)
            await page.locator("#example-presence-custom").click()
            await page.waitForTimeout(expected.sampleMs)
            const { x } = await translate(target)
            expect(x, `${renderer} custom=2 exit progress`).toBeGreaterThanOrEqual(
                expected.minX
            )
            expect(x).toBeLessThanOrEqual(expected.maxX)
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
            await page.locator("#example-presence-propagation").click()
            await page.waitForTimeout(expected.midExitMs)
            expect(
                await opacity(target),
                `${renderer} grandchild follows the exit label`
            ).toBeLessThan(expected.maxMidOpacity)
            await expect(target, `${renderer} subtree released`).toHaveCount(0, {
                timeout: 3_000,
            })
        }
        expect(scene.errors).toEqual([])
        await scene.close()
    })
})
