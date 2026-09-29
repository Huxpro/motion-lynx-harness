import { expect, test, type Browser, type Locator, type Page } from "@playwright/test"

import {
    EASING_FUNCTION_ARRAY_CASE,
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
