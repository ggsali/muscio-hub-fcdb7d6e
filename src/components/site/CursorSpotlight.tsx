import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export const CursorSpotlight = () => {
  const mouseX = useMotionValue(-400);
  const mouseY = useMotionValue(-400);
  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 });
  const visible = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      visible.current = true;
    };
    const leave = () => {
      mouseX.set(-400);
      mouseY.set(-400);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed z-[9999] hidden md:block"
      style={{ x: springX, y: springY, translateX: "-50%", translateY: "-50%" }}
    >
      <div style={{ width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, hsl(156 100% 40% / 0.07) 0%, transparent 70%)", transform: "translate(-50%, -50%)", position: "absolute", top: 0, left: 0 }} />
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, hsl(156 100% 40% / 0.12) 0%, transparent 70%)", transform: "translate(-50%, -50%)", position: "absolute", top: 0, left: 0 }} />
    </motion.div>
  );
};
