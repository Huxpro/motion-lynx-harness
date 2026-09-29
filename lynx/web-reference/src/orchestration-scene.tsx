import { motion, stagger, useAnimationControls } from "framer-motion"
import { useState, type CSSProperties } from "react"

import { ORCHESTRATION_CASES } from "../../src/conformance/cases"

/**
 * Variant orchestration, animation controls, and gesture propagation
 * conformance scenes. The ReactLynx Gallery renders the same scenes in
 * `src/scenes/OrchestrationScene.tsx`; only host tags differ.
 */

const card: CSSProperties = {
    cursor: "pointer",
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
        <div id="orchestration-scenes">
            <div id="example-orch-tap-propagation" style={card}>
                <span style={title}>whileTap label</span>
                <div style={demo}>
                    <motion.div
                        id="target-orch-tap-parent"
                        style={{ ...box, width: "72px", height: "56px" }}
                        whileTap="pressed"
                    >
                        <motion.div
                            id="target-orch-tap-child"
                            style={{ ...box, opacity: 0.3 }}
                            variants={{ pressed: { opacity: 1 } }}
                            transition={{ type: false }}
                        />
                    </motion.div>
                </div>
            </div>

            <div id="example-orch-hover-propagation" style={card}>
                <span style={title}>whileHover label</span>
                <div style={demo}>
                    <motion.div
                        id="target-orch-hover-parent"
                        style={{ ...box, width: "72px", height: "56px" }}
                        whileHover="hovered"
                        variants={{ hovered: { opacity: 0.9 } }}
                        transition={{ type: false }}
                    >
                        <motion.div
                            id="target-orch-hover-child"
                            style={{ ...box, opacity: 1 }}
                            variants={{ hovered: { opacity: 0.2 } }}
                            transition={{ type: false }}
                        />
                    </motion.div>
                </div>
            </div>

            <div
                id="example-orch-after-children"
                style={card}
                onClick={() => setAfterActive((active) => !active)}
            >
                <span style={title}>afterChildren</span>
                <div style={demo}>
                    <motion.div
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
                        <motion.div
                            id="target-orch-after-child"
                            style={box}
                            variants={{
                                hidden: { opacity: hiddenOpacity },
                                visible: { opacity: visibleOpacity },
                            }}
                            transition={linear}
                        />
                    </motion.div>
                </div>
            </div>

            <div
                id="example-orch-before-children"
                style={card}
                onClick={() => setBeforeActive(true)}
            >
                <span style={title}>beforeChildren (spring)</span>
                <div style={demo}>
                    <motion.div
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
                        <motion.div
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
                    </motion.div>
                </div>
            </div>

            <div
                id="example-orch-stagger-function"
                style={card}
                onClick={() => setStaggerActive(true)}
            >
                <span style={title}>delayChildren: stagger()</span>
                <motion.div
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
                        <motion.div
                            key={index}
                            id={`target-orch-stagger-function-${index}`}
                            style={box}
                            variants={fade}
                        />
                    ))}
                </motion.div>
            </div>

            <div
                id="example-orch-stagger-children"
                style={card}
                onClick={() => setStaggerChildrenActive(true)}
            >
                <span style={title}>staggerChildren</span>
                <motion.div
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
                        <motion.div
                            key={index}
                            id={`target-orch-stagger-children-${index}`}
                            style={box}
                            variants={fade}
                        />
                    ))}
                </motion.div>
            </div>

            <div
                id="example-orch-stagger-transparent"
                style={card}
                onClick={() => setTransparentActive(true)}
            >
                <span style={title}>Transparent stagger order</span>
                <motion.div
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
                    <motion.div style={{ display: "flex", flexDirection: "row" }}>
                        <motion.div />
                        <motion.div
                            id="target-orch-transparent-1"
                            style={box}
                            variants={fade}
                        />
                        <motion.div
                            id="target-orch-transparent-2"
                            style={box}
                            variants={fade}
                        />
                    </motion.div>
                    <motion.div style={{ display: "flex", flexDirection: "row" }}>
                        <motion.div
                            id="target-orch-transparent-3"
                            style={box}
                            variants={fade}
                        />
                        <motion.div
                            id="target-orch-transparent-4"
                            style={box}
                            variants={fade}
                        />
                    </motion.div>
                </motion.div>
            </div>

            <div
                id="example-orch-controls"
                style={card}
                onClick={() => {
                    setControlsStatus("started")
                    void controls
                        .start("foo")
                        .then(() => setControlsStatus("resolved"))
                }}
            >
                <div>
                    <span style={title}>controls.start</span>
                    <span id="orch-controls-status" style={status}>
                        {controlsStatus}
                    </span>
                </div>
                <div style={demo}>
                    <motion.div
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
                        <motion.div
                            id="target-orch-controls-child"
                            style={{ ...box, opacity: hiddenOpacity }}
                            variants={{
                                foo: {
                                    opacity: visibleOpacity,
                                    transition: { duration: 0.3 },
                                },
                            }}
                        />
                    </motion.div>
                </div>
            </div>

            <div
                id="example-orch-controls-set"
                style={card}
                onClick={() =>
                    setControls.set({
                        x: ORCHESTRATION_CASES.controlsSet.expected.x,
                    })
                }
            >
                <span style={title}>controls.set</span>
                <div style={demo}>
                    <motion.div
                        id="target-orch-set-a"
                        style={box}
                        animate={setControls}
                    />
                    <motion.div
                        id="target-orch-set-b"
                        style={box}
                        animate={setControls}
                    />
                </div>
            </div>
        </div>
    )
}
