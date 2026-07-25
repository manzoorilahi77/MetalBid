import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';

// TODO: swap in real co-founder/director names, roles, quotes, and photos.
const leadership = [
  {
    photo: `${import.meta.env.BASE_URL}zaid.jpg`,
    quote:
      'I started FerroBid because I watched too many honest traders lose money to middlemen and guesswork. Today, every lot on our platform is verified and every bid is transparent.',
    name: 'Zaid Ahmed',
    role: 'Founder & CEO',
  },
  {
    photo: null,
    quote:
      'Our sellers trust us with their livelihood every time they list a lot. Building that trust, one verified auction at a time, is what drives our operations team every day.',
    name: 'Aisha Rahman',
    role: 'Co-Founder & COO',
  },
  {
    photo: null,
    quote:
      "Scaling FerroBid means scaling trust, not just transactions. Every feature we ship is measured against one question: does this make the marketplace fairer?",
    name: 'Rohan Mehta',
    role: 'Director of Operations',
  },
  {
    photo: null,
    quote:
      'From real-time fraud detection to instant settlements, our engineering team is obsessed with making complex trades feel effortless for every buyer and seller.',
    name: 'Priya Nair',
    role: 'Director of Technology',
  },
];

const cardVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 260 : -260,
    opacity: 0,
    scale: 0.75,
    rotateY: direction > 0 ? 55 : -55,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
  },
  exit: (direction) => ({
    x: direction > 0 ? -260 : 260,
    opacity: 0,
    scale: 0.75,
    rotateY: direction > 0 ? -55 : 55,
  }),
};

const SWIPE_THRESHOLD = 80;
const swipePower = (offset, velocity) => Math.abs(offset) * velocity;

export const TestimonialsSection = () => {
  const [failedPhotos, setFailedPhotos] = useState({});
  const [[index, direction], setPage] = useState([0, 0]);

  const markFailed = (name) => setFailedPhotos((prev) => ({ ...prev, [name]: true }));

  const activeIndex = ((index % leadership.length) + leadership.length) % leadership.length;

  const paginate = (newDirection) => {
    setPage([index + newDirection, newDirection]);
  };

  const goTo = (target) => {
    const newDirection = target > activeIndex ? 1 : target < activeIndex ? -1 : 0;
    setPage([target, newDirection]);
  };

  const person = leadership[activeIndex];

  return (
    <section className="testimonials-section">
      <div className="testimonials-glow" aria-hidden="true"></div>
      <div className="container">
        <div className="section-eyebrow">Leadership</div>
        <h2 className="testimonials-heading">A Word from Our Leadership</h2>
      </div>

      <div className="container">
        <div className="testimonials-stage">
          <div className="testimonials-viewport">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                className="testimonial-card"
                key={activeIndex}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 320, damping: 32 },
                  rotateY: { type: 'spring', stiffness: 320, damping: 32 },
                  opacity: { duration: 0.25 },
                  scale: { duration: 0.35 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(e, { offset, velocity }) => {
                  const power = swipePower(offset.x, velocity.x);
                  if (offset.x < -SWIPE_THRESHOLD || power < -8000) {
                    paginate(1);
                  } else if (offset.x > SWIPE_THRESHOLD || power > 8000) {
                    paginate(-1);
                  }
                }}
              >
                <div className="testimonial-photo-col">
                  <div className="testimonial-photo-frame">
                    {!person.photo || failedPhotos[person.name] ? (
                      <div className="testimonial-photo testimonial-photo-fallback">
                        {person.name.charAt(0)}
                      </div>
                    ) : (
                      <img
                        src={person.photo}
                        alt={person.name}
                        loading="lazy"
                        decoding="async"
                        className="testimonial-photo"
                        onError={() => markFailed(person.name)}
                      />
                    )}
                  </div>
                  <div className="testimonial-photo-badge">
                    <BadgeCheck size={16} />
                  </div>
                </div>

                <div className="testimonial-body">
                  <p className="testimonial-quote">{person.quote}</p>
                  <div className="testimonial-signature">
                    <div className="testimonial-signature-line"></div>
                    <div>
                      <div className="testimonial-author">{person.name}</div>
                      <div className="testimonial-role">{person.role}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <motion.button
              className="testimonial-nav left"
              aria-label="Previous leadership quote"
              onClick={() => paginate(-1)}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <ChevronLeft size={22} />
            </motion.button>
            <motion.button
              className="testimonial-nav right"
              aria-label="Next leadership quote"
              onClick={() => paginate(1)}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <ChevronRight size={22} />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="testimonials-dots">
        {leadership.map((_, i) => (
          <motion.button
            key={i}
            layout
            className={`testimonials-dot ${i === activeIndex ? 'active' : ''}`}
            aria-label={`Go to leadership quote ${i + 1}`}
            onClick={() => goTo(i)}
            whileHover={{ scale: i === activeIndex ? 1 : 1.4 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        ))}
      </div>
    </section>
  );
};
