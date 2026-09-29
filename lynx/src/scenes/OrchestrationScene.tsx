import type { CSSProperties } from "@lynx-js/types"
import { useState } from "@lynx-js/react"

import { ORCHESTRATION_CASES } from "../conformance/cases.js"
import {
    motion,
    stagger,
    useAnimationControls,
} from "../motion/index.js"

/**
 * Variant orchestration, animation controls, and gesture propagation
 * conformance scenes. The Web reference renders the same scenes in
 * `web-reference/src/orchestration-scene.tsx`; only host tags differ.
 */

const card: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#171d1f",
    borderRadius: "16px",
    paddingLeft: "20px",
    paddingRight: "20px",
    marginBottom: "14px",
    height: "104px",
}
const title: CSSProperties = {
    color: "#ffffff",
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: "bold",
    fontFamily: "sans-serif",
}
const status: CSSProperties = {
    color: "#3e98ff",
    fontSize: "12px",
    lineHeight: "16px",
    fontFamily: "monospace",
}
const demo: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "180px",
    height: "80px",
}
const box: CSSProperties = {
    width: "28px",
    height: "28px",
    borderRadius: "7px",
    marginLeft: "4px",
    marginRight: "4px",
    backgroundColor: "#9b72f2",
}

const { hiddenOpacity, visibleOpacity, stepMs, childMs } =
    ORCHESTRATION_CASES.staggerFunction.expected
const fade = {
    hidden: { opacity: hiddenOpacity },
    visible: {
        opacity: visibleOpacity,
        transition: { duration: childMs / 1000 },
    },
}
const afterChildrenMs = ORCHESTRATION_CASES.afterChildren.expected.durationMs
const linear = { duration: afterChildrenMs / 1000, ease: "linear" as const }

export function OrchestrationScene() {
    const [afterActive, setAfterActive] = useState(false)
    const [beforeActive, setBeforeActive] = useState(false)
    const [staggerActive, setStaggerActive] = useState(false)
    const [staggerChildrenActive, setStaggerChildrenActive] = useState(false)
    const [transparentActive, setTransparentActive] = useState(false)
    const [controlsStatus, setControlsStatus] = useState("idle")
    const controls = useAnimationControls()
    const setControls = useAnimationControls()

    return (
        <view id="orchestration-scenes">
            <view id="example-orch-tap-propagation" style={card}>
                <text style={title}>whileTap label</text>
                <view style={demo}>
                    <motion.view
                        id="target-orch-tap-parent"
                        style={{ ...box, width: "72px", height: "56px" }}
                        whileTap="pressed"
                    >
                        <motion.view
                            id="target-orch-tap-child"
                            style={{ ...box, opacity: 0.3 }}
                            variants={{ pressed: { opacity: 1 } }}
                            transition={{ type: false }}
                        />
                    </motion.view>
                </view>
            </view>

            <view id="example-orch-hover-propagation" style={card}>
                <text style={title}>whileHover label</text>
                <view style={demo}>
                    <motion.view
                        id="target-orch-hover-parent"
                        style={{ ...box, width: "72px", height: "56px" }}
                        whileHover="hovered"
                        variants={{ hovered: { opacity: 0.9 } }}
                        transition={{ type: false }}
                    >
                        <motion.view
                            id="target-orch-hover-child"
                            style={{ ...box, opacity: 1 }}
                            variants={{ hovered: { opacity: 0.2 } }}
                            transition={{ type: false }}
                        />
                    </motion.view>
                </view>
            </view>

            <view
                id="example-orch-after-children"
                style={card}
                bindtap={() => setAfterActive((active) => !active)}
            >
                <text style={title}>afterChildren</text>
                <view style={demo}>
                    <motion.view
                        id="target-orch-after-parent"
                        style={{ ...box, width: "72px", height: "56px" }}
                        initial="hidden"
                        animate={afterActive ? "visible" : "hidden"}
                        variants={{
                            hidden: { opacity: hiddenOpacity },
                            visible: { opacity: visibleOpacity },
                        }}
                        transition={{ ...linear, when: "afterChildren" }}
                    >
                        <motion.view
                            id="target-orch-after-child"
                            style={box}
                            variants={{
                                hidden: { opacity: hiddenOpacity },
                                visible: { opacity: visibleOpacity },
                            }}
                            transition={linear}
                        />
                    </motion.view>
                </view>
            </view>

            <view
                id="example-orch-before-children"
                style={card}
                bindtap={() => setBeforeActive(true)}
            >
                <text style={title}>beforeChildren (spring)</text>
                <view style={demo}>
                    <motion.view
                        id="target-orch-before-parent"
                        style={{ ...box, width: "56px", height: "56px" }}
                        initial="hidden"
                        animate={beforeActive ? "visible" : "hidden"}
                        variants={{
                            hidden: { x: 0 },
                            visible: {
                                x: ORCHESTRATION_CASES.beforeChildrenAutomatic
                                    .expected.parentX,
                                transition: {
                                    when: "beforeChildren",
                                    type: "spring",
                                    stiffness: 120,
                                    damping: 20,
                                },
                            },
                        }}
                    >
                        <motion.view
                            id="target-orch-before-child"
                            style={box}
                            variants={{
                                hidden: { opacity: hiddenOpacity },
                                visible: {
                                    opacity: visibleOpacity,
                                    transition: { type: false },
                                },
                            }}
                        />
                    </motion.view>
                </view>
            </view>

            <view
                id="example-orch-stagger-function"
                style={card}
                bindtap={() => setStaggerActive(true)}
            >
                <text style={title}>delayChildren: stagger()</text>
                <motion.view
                    style={demo}
                    initial="hidden"
                    animate={staggerActive ? "visible" : "hidden"}
                    variants={{
                        hidden: {},
                        visible: {
                            transition: { delayChildren: stagger(stepMs / 1000) },
                        },
                    }}
                >
                    {[0, 1, 2].map((index) => (
                        <motion.view
                            key={index}
                            id={`target-orch-stagger-function-${index}`}
                            style={box}
                            variants={fade}
                        />
                    ))}
                </motion.view>
            </view>

            <view
                id="example-orch-stagger-children"
                style={card}
                bindtap={() => setStaggerChildrenActive(true)}
            >
                <text style={title}>staggerChildren</text>
                <motion.view
                    style={demo}
                    initial="hidden"
                    animate={staggerChildrenActive ? "visible" : "hidden"}
                    variants={{
                        hidden: {},
                        visible: {
                            transition: { staggerChildren: stepMs / 1000 },
                        },
                    }}
                >
                    {[0, 1, 2].map((index) => (
                        <motion.view
                            key={index}
                            id={`target-orch-stagger-children-${index}`}
                            style={box}
                            variants={fade}
                        />
                    ))}
                </motion.view>
            </view>

            <view
                id="example-orch-stagger-transparent"
                style={card}
                bindtap={() => setTransparentActive(true)}
            >
                <text style={title}>Transparent stagger order</text>
                <motion.view
                    style={demo}
                    initial="hidden"
                    animate={transparentActive ? "visible" : "hidden"}
                    variants={{
                        visible: {
                            transition: {
                                staggerChildren: stepMs / 1000,
                                staggerDirection: -1,
                            },
                        },
                    }}
                >
                    <motion.view style={{ display: "flex", flexDirection: "row" }}>
                        <motion.view />
                        <motion.view
                            id="target-orch-transparent-1"
                            style={box}
                            variants={fade}
                        />
                        <motion.view
                            id="target-orch-transparent-2"
                            style={box}
                            variants={fade}
                        />
                    </motion.view>
                    <motion.view style={{ display: "flex", flexDirection: "row" }}>
                        <motion.view
                            id="target-orch-transparent-3"
                            style={box}
                            variants={fade}
                        />
                        <motion.view
                            id="target-orch-transparent-4"
                            style={box}
                            variants={fade}
                        />
                    </motion.view>
                </motion.view>
            </view>

            <view
                id="example-orch-controls"
                style={card}
                bindtap={() => {
                    setControlsStatus("started")
                    void controls
                        .start("foo")
                        .then(() => setControlsStatus("resolved"))
                }}
            >
                <view>
                    <text style={title}>controls.start</text>
                    <text id="orch-controls-status" style={status}>
                        {controlsStatus}
                    </text>
                </view>
                <view style={demo}>
                    <motion.view
                        id="target-orch-controls-parent"
                        style={{ ...box, width: "56px", height: "56px" }}
                        animate={controls}
                        variants={{
                            foo: {
                                x: ORCHESTRATION_CASES.controlsStart.expected.x,
                                transition: { duration: 0.3 },
                            },
                        }}
                    >
                        <motion.view
                            id="target-orch-controls-child"
                            style={{ ...box, opacity: hiddenOpacity }}
                            variants={{
                                foo: {
                                    opacity: visibleOpacity,
                                    transition: { duration: 0.3 },
                                },
                            }}
                        />
                    </motion.view>
                </view>
            </view>

            <view
                id="example-orch-controls-set"
                style={card}
                bindtap={() =>
                    setControls.set({
                        x: ORCHESTRATION_CASES.controlsSet.expected.x,
                    })
                }
            >
                <text style={title}>controls.set</text>
                <view style={demo}>
                    <motion.view
                        id="target-orch-set-a"
                        style={box}
                        animate={setControls}
                    />
                    <motion.view
                        id="target-orch-set-b"
                        style={box}
                        animate={setControls}
                    />
                </view>
            </view>
        </view>
    )
}
