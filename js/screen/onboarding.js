// Non-blocking 5-step interactive onboarding tutorial overlay

const STEPS = [
  {
    title: '1. Move Around',
    desc: 'Slide the left joystick (or use Arrow keys / A & D) to position Kai under the ball.',
    highlightId: 'touch-joystick',
  },
  {
    title: '2. Jump High',
    desc: 'Tap the JUMP button (or press Up / W / Space) to leap near the net for blocks and attacks.',
    highlightId: 'touch-btn-jump',
  },
  {
    title: '3. Receive & Serve',
    desc: 'Press RECV (or Space) when the ball arrives to pass it up — and press it behind the line to serve.',
    highlightId: 'touch-btn-receive',
  },
  {
    title: '4. Watch the Auto-Set',
    desc: 'Your teammate Mina automatically sets Touch 2 with a golden trail and ring. Get ready under the arc!',
    highlightId: 'onboarding-ball-ring',
  },
  {
    title: '5. Smash at the Peak',
    desc: 'Jump toward the set and tap SMASH (or Space) right when the golden ring lights up near your peak!',
    highlightId: 'touch-btn-smash',
  },
];

export function createOnboardingScreen({ onComplete }) {
  const overlayEl = document.getElementById('onboarding-overlay');
  const ballRingEl = document.getElementById('onboarding-ball-ring');
  const stepLabelEl = document.getElementById('onboarding-step-label');
  const titleEl = document.getElementById('onboarding-title');
  const descEl = document.getElementById('onboarding-desc');
  const btnPrev = document.getElementById('btn-onboarding-prev');
  const btnNext = document.getElementById('btn-onboarding-next');
  const btnSkip = document.getElementById('btn-onboarding-skip');

  let active = false;
  let stepIndex = 0;
  let highlightedEl = null;

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.classList.remove('onboarding-highlight');
      highlightedEl = null;
    }
    if (ballRingEl) {
      ballRingEl.hidden = true;
    }
  }

  function renderStep() {
    clearHighlight();
    const step = STEPS[stepIndex];
    if (!step) return;

    if (stepLabelEl) stepLabelEl.textContent = `Step ${stepIndex + 1} of ${STEPS.length}`;
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.textContent = step.desc;
    if (btnPrev) btnPrev.disabled = stepIndex === 0;
    if (btnNext) btnNext.textContent = stepIndex === STEPS.length - 1 ? 'Play Match' : 'Next';

    const target = document.getElementById(step.highlightId);
    if (target) {
      if (step.highlightId === 'onboarding-ball-ring') {
        target.hidden = false;
      } else {
        target.classList.add('onboarding-highlight');
        highlightedEl = target;
      }
    }
  }

  function start() {
    active = true;
    stepIndex = 0;
    if (overlayEl) overlayEl.hidden = false;
    renderStep();
  }

  function finish(startRealMatch = true) {
    if (!active) return;
    active = false;
    clearHighlight();
    if (overlayEl) overlayEl.hidden = true;
    onComplete?.({ startRealMatch });
  }

  btnPrev?.addEventListener('click', () => {
    btnPrev.blur();
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderStep();
    }
  });

  btnNext?.addEventListener('click', () => {
    btnNext.blur();
    if (stepIndex < STEPS.length - 1) {
      stepIndex += 1;
      renderStep();
    } else {
      finish(true);
    }
  });

  btnSkip?.addEventListener('click', () => {
    btnSkip.blur();
    finish(true);
  });

  return {
    start,
    hide: () => finish(false),
    isActive: () => active,
  };
}
