import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { formatMoney } from "../../../../lib/utils";

/* ── Money that springs between values — count-up on mount, quick roll on
      live updates (exchange-ticker feel). ──────────── */
export default function AnimatedMoney({ value, className, snappy = false }) {
  const spring = useSpring(
    0,
    snappy
      ? { stiffness: 190, damping: 26, mass: 0.5 }
      : { stiffness: 80, damping: 21, mass: 0.9 },
  );
  const text = useTransform(spring, (v) => formatMoney(v));

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [spring, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
