"""Synthetic DEMO history: 5-minute speed-ratio observations for every road segment.
Generated with the same demand pattern, noise and incident rules as the live demo
engine, so the model is trained and tested on data of the same kind it will see.
This is NOT real sensor data."""
import numpy as np

STEP = 5  # minutes between observations


def generate(w, S, profile, demand, boost, days=21, seed=42, phi=.8, sd=.1, clip=.2):
    rng = np.random.default_rng(seed)
    E, T = len(w), days * 288
    hours = (np.arange(T) * STEP / 60) % 24
    base = np.minimum(1, np.array([profile(h) for h in hours])[:, None] * w[None, :] * demand)
    s, n, noise = sd * np.sqrt(1 - phi ** 2), rng.normal(0, sd, E), np.zeros((T, E))
    for t in range(T):
        n = np.clip(phi * n + rng.normal(0, s, E), -clip, clip)
        noise[t] = n
    inc = np.zeros((T, E))
    for t in range(T):  # random incidents: severity 1-3, 15-40 minutes, spill onto neighbouring segments
        for e in np.nonzero(rng.random(E) < .0006)[0]:
            inc[t:t + int(rng.integers(3, 9))] += boost[int(rng.integers(1, 4))] * S[e][None, :]
    return 1 - .88 * np.clip(base + noise + inc, 0, 1), hours
