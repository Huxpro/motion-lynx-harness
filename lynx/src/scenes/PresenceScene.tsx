import type { CSSProperties } from "@lynx-js/types"
import { useState } from "@lynx-js/react"

import { PRESENCE_CASES } from "../conformance/cases.js"
import { AnimatePresence, motion } from "../motion/index.js"

/**
 * AnimatePresence conformance scenes. The Web reference renders the same
 * scenes in `web-reference/src/presence-scene.tsx`; only host tags differ.
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
        <view id="presence-scenes">
            <view
                id="example-presence-exit"
                style={card}
                bindtap={() => setExitVisible(false)}
            >
                <view>
                    <text style={title}>Exit before removal</text>
                    <text id="presence-exit-status" style={status}>
                        {`exit-complete:${exitCompletions}`}
                    </text>
                </view>
                <view style={demo}>
                    <AnimatePresence
                        onExitComplete={() => setExitCompletions((n) => n + 1)}
                    >
                        {exitVisible && (
                            <motion.view
                                key="exit"
                                id="target-presence-exit"
                                style={{ ...box, opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={linear(exitMs / 1000)}
                            />
                        )}
                    </AnimatePresence>
                </view>
            </view>

            <view id="example-presence-initial-false" style={card}>
                <text style={title}>initial=false</text>
                <view style={demo}>
                    <AnimatePresence initial={false}>
                        <motion.view
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
                </view>
            </view>

            <view
                id="example-presence-reenter"
                style={card}
                bindtap={() => {
                    setReenterVisible(false)
                    setTimeout(
                        () => setReenterVisible(true),
                        PRESENCE_CASES.reenter.expected.reenterAfterMs
                    )
                }}
            >
                <text style={title}>Re-enter before exit ends</text>
                <view style={demo}>
                    <AnimatePresence>
                        {reenterVisible && (
                            <motion.view
                                key="reenter"
                                id="target-presence-reenter"
                                style={box}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={linear(exitMs / 1000)}
                            />
                        )}
                    </AnimatePresence>
                </view>
            </view>

            <view
                id="example-presence-wait"
                style={card}
                bindtap={() => {
                    setWaitIndex((i) => i + 1)
                    setTimeout(() => setWaitIndex((i) => i + 1), 50)
                }}
            >
                <text style={title}>mode="wait"</text>
                <view id="presence-wait-items" style={demo}>
                    <AnimatePresence mode="wait">
                        <motion.view
                            key={waitIndex}
                            id={`presence-wait-item-${waitIndex}`}
                            style={box}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={linear(exitMs / 1000)}
                        />
                    </AnimatePresence>
                </view>
            </view>

            <view
                id="example-presence-no-exit"
                style={card}
                bindtap={() => setNoExitIndex((i) => i + 1)}
            >
                <text style={title}>No exit animation</text>
                <view id="presence-no-exit-items" style={demo}>
                    <AnimatePresence mode="wait">
                        <motion.view
                            key={noExitIndex}
                            id={`presence-no-exit-item-${noExitIndex}`}
                            style={box}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        />
                    </AnimatePresence>
                </view>
            </view>

            <view
                id="example-presence-custom"
                style={card}
                bindtap={() => setCustomVisible(false)}
            >
                <text style={title}>AnimatePresence custom</text>
                <view style={demo}>
                    <AnimatePresence custom={2}>
                        {customVisible && (
                            <motion.view
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
                </view>
            </view>

            <view
                id="example-presence-propagation"
                style={card}
                bindtap={() => setPropagateVisible(false)}
            >
                <text style={title}>Exit through variants</text>
                <view style={demo}>
                    <AnimatePresence>
                        {propagateVisible && (
                            <motion.view
                                key="propagate"
                                initial="enter"
                                animate="enter"
                                exit="exit"
                                variants={PROPAGATION_VARIANTS}
                            >
                                <motion.view variants={PROPAGATION_VARIANTS}>
                                    <motion.view
                                        id="target-presence-propagation"
                                        style={box}
                                        variants={PROPAGATION_VARIANTS}
                                    />
                                </motion.view>
                            </motion.view>
                        )}
                    </AnimatePresence>
                </view>
            </view>
        </view>
    )
}

const PROPAGATION_VARIANTS = {
    enter: { opacity: 1, transition: { type: false as const } },
    exit: { opacity: 0, transition: linear(exitMs / 1000) },
}
