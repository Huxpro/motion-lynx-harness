import { AnimatePresence, motion } from "framer-motion"
import { useState, type CSSProperties } from "react"

import { PRESENCE_CASES } from "../../src/conformance/cases"

/**
 * AnimatePresence conformance scenes. The ReactLynx Gallery renders the same
 * scenes in `src/scenes/PresenceScene.tsx`; only host tags differ.
 */

const card: CSSProperties = {
    cursor: "pointer",
    boxSizing: "border-box",
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
    width: "148px",
    height: "80px",
}
const box: CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    backgroundColor: "#9b72f2",
}

const { exitMs, customExitMs } = PRESENCE_CASES.exit.expected
const linear = (seconds: number) => ({ duration: seconds, ease: "linear" as const })

export function PresenceScene() {
    const [exitVisible, setExitVisible] = useState(true)
    const [exitCompletions, setExitCompletions] = useState(0)
    const [reenterVisible, setReenterVisible] = useState(true)
    const [waitIndex, setWaitIndex] = useState(0)
    const [noExitIndex, setNoExitIndex] = useState(0)
    const [customVisible, setCustomVisible] = useState(true)
    const [propagateVisible, setPropagateVisible] = useState(true)

    return (
        <div id="presence-scenes">
            <div
                id="example-presence-exit"
                style={card}
                onClick={() => setExitVisible(false)}
            >
                <div>
                    <span style={title}>Exit before removal</span>
                    <span id="presence-exit-status" style={status}>
                        {`exit-complete:${exitCompletions}`}
                    </span>
                </div>
                <div style={demo}>
                    <AnimatePresence
                        onExitComplete={() => setExitCompletions((n) => n + 1)}
                    >
                        {exitVisible && (
                            <motion.div
                                key="exit"
                                id="target-presence-exit"
                                style={{ ...box, opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={linear(exitMs / 1000)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div id="example-presence-initial-false" style={card}>
                <span style={title}>initial=false</span>
                <div style={demo}>
                    <AnimatePresence initial={false}>
                        <motion.div
                            key="initial"
                            id="target-presence-initial-false"
                            style={box}
                            initial={{ x: 0 }}
                            animate={{
                                x: PRESENCE_CASES.initialFalse.expected.x,
                            }}
                            exit={{ opacity: 0 }}
                        />
                    </AnimatePresence>
                </div>
            </div>

            <div
                id="example-presence-reenter"
                style={card}
                onClick={() => {
                    setReenterVisible(false)
                    setTimeout(
                        () => setReenterVisible(true),
                        PRESENCE_CASES.reenter.expected.reenterAfterMs
                    )
                }}
            >
                <span style={title}>Re-enter before exit ends</span>
                <div style={demo}>
                    <AnimatePresence>
                        {reenterVisible && (
                            <motion.div
                                key="reenter"
                                id="target-presence-reenter"
                                style={box}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={linear(exitMs / 1000)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div
                id="example-presence-wait"
                style={card}
                onClick={() => {
                    setWaitIndex((i) => i + 1)
                    setTimeout(() => setWaitIndex((i) => i + 1), 50)
                }}
            >
                <span style={title}>mode="wait"</span>
                <div id="presence-wait-items" style={demo}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={waitIndex}
                            id={`presence-wait-item-${waitIndex}`}
                            style={box}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={linear(exitMs / 1000)}
                        />
                    </AnimatePresence>
                </div>
            </div>

            <div
                id="example-presence-no-exit"
                style={card}
                onClick={() => setNoExitIndex((i) => i + 1)}
            >
                <span style={title}>No exit animation</span>
                <div id="presence-no-exit-items" style={demo}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={noExitIndex}
                            id={`presence-no-exit-item-${noExitIndex}`}
                            style={box}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        />
                    </AnimatePresence>
                </div>
            </div>

            <div
                id="example-presence-custom"
                style={card}
                onClick={() => setCustomVisible(false)}
            >
                <span style={title}>AnimatePresence custom</span>
                <div style={demo}>
                    <AnimatePresence custom={2}>
                        {customVisible && (
                            <motion.div
                                key="custom"
                                id="target-presence-custom"
                                style={box}
                                custom={1}
                                variants={{
                                    enter: { x: 0, transition: { type: false } },
                                    exit: (i: unknown) => ({
                                        x: Number(i) * 40,
                                        transition: linear(customExitMs / 1000),
                                    }),
                                }}
                                initial="exit"
                                animate="enter"
                                exit="exit"
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div
                id="example-presence-propagation"
                style={card}
                onClick={() => setPropagateVisible(false)}
            >
                <span style={title}>Exit through variants</span>
                <div style={demo}>
                    <AnimatePresence>
                        {propagateVisible && (
                            <motion.div
                                key="propagate"
                                initial="enter"
                                animate="enter"
                                exit="exit"
                                variants={PROPAGATION_VARIANTS}
                            >
                                <motion.div variants={PROPAGATION_VARIANTS}>
                                    <motion.div
                                        id="target-presence-propagation"
                                        style={box}
                                        variants={PROPAGATION_VARIANTS}
                                    />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

const PROPAGATION_VARIANTS = {
    enter: { opacity: 1, transition: { type: false as const } },
    exit: { opacity: 0, transition: linear(exitMs / 1000) },
}
