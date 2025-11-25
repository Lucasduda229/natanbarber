import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const AnimatedBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create particles
    const particleCount = window.innerWidth < 768 ? 15 : 30;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 4 + 2}px;
        height: ${Math.random() * 4 + 2}px;
        background: hsl(45 75% 52% / ${Math.random() * 0.6 + 0.2});
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        bottom: -10px;
        box-shadow: 0 0 10px hsl(45 75% 52% / 0.5);
      `;
      containerRef.current.appendChild(particle);
      particlesRef.current.push(particle);

      // Animate particles
      gsap.to(particle, {
        y: -(window.innerHeight + 100),
        x: `+=${Math.random() * 100 - 50}`,
        opacity: 0,
        duration: Math.random() * 10 + 10,
        repeat: -1,
        delay: Math.random() * 5,
        ease: "none",
      });
    }

    // Background gradient animation
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(containerRef.current, {
      backgroundPosition: "0% 50%",
      duration: 15,
      ease: "none",
    }).to(containerRef.current, {
      backgroundPosition: "100% 50%",
      duration: 15,
      ease: "none",
    });

    return () => {
      particlesRef.current.forEach(p => p.remove());
      particlesRef.current = [];
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at top, hsl(45 75% 52% / 0.1), transparent 50%),
          radial-gradient(ellipse at bottom, hsl(45 60% 40% / 0.08), transparent 50%),
          linear-gradient(180deg, hsl(0 0% 5.5%), hsl(0 0% 3%))
        `,
        backgroundSize: "200% 200%",
      }}
    >
      {/* Subtle blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[1px]" />
    </div>
  );
};

export default AnimatedBackground;
