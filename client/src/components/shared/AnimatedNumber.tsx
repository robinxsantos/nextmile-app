import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export default function AnimatedNumber({ value, format = (n) => n.toLocaleString(), className }: AnimatedNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate(latest) {
        node.textContent = format(latest);
      },
    });

    prevValue.current = value;

    return () => controls.stop();
  }, [value, format]);

  return <span ref={nodeRef} className={className}>{format(value)}</span>;
}
