"""30-minute congestion forecaster: ridge regression, direct multi-horizon (+5 ... +30 min).
Inputs per road segment: its last six 5-minute speed ratios (speed / free-flow speed),
time of day (harmonics) and the segment's typical demand level.
Output: predicted speed ratio at +5, +10, +15, +20, +25 and +30 minutes."""
import json, os
import numpy as np

H, L, MIN_RATIO = 6, 6, .12
INFO = dict(name="Ridge regression (direct 6-step forecast)",
            inputs="last 6 five-minute speed readings of the segment, time of day, typical demand of the segment")


def _feat(lags, hour, w):
    a = (2 * np.pi * np.asarray(hour) / 24)[:, None] * np.arange(1, 7)[None, :]
    h = np.hstack([np.sin(a), np.cos(a)])
    return np.hstack([lags, h, h * w[:, None], w[:, None], np.ones((len(w), 1))])


def _dataset(R, hours, w, free):
    T, E = R.shape
    ts = np.arange(L - 1, T - H)
    lags = np.stack([R[ts - i] for i in range(L)], axis=2).reshape(-1, L)          # most recent first
    Y = np.stack([R[ts + k + 1] for k in range(H)], axis=2).reshape(-1, H)
    rep = lambda v: np.repeat(v[None, :], len(ts), 0).ravel()
    return lags, np.repeat(hours[ts], E), rep(w), Y, rep(free), np.repeat(ts, E)


def train(R, hours, w, free, test_days=4, lam=1e-3):
    lags, hr, ww, Y, fr, tt = _dataset(R, hours, w, free)
    tr = tt < R.shape[0] - test_days * 288
    te = ~tr
    X, D = _feat(lags, hr, ww), Y - lags[:, [0]]
    B = np.linalg.solve(X[tr].T @ X[tr] + lam * np.eye(X.shape[1]), X[tr].T @ D[tr])
    P = np.clip(lags[:, [0]] + X @ B, MIN_RATIO, 1)
    err = np.abs(P[te] - Y[te]) * fr[te][:, None]
    base = np.abs(lags[te][:, [0]] - Y[te]) * fr[te][:, None]
    metrics = dict(mae_model_kmh=err.mean(0).round(2).tolist(), mae_persistence_kmh=base.mean(0).round(2).tolist(),
                   train_days=R.shape[0] // 288 - test_days, test_days=test_days,
                   train_samples=int(tr.sum()), test_samples=int(te.sum()))
    return B, metrics


def predict(B, lags, hour, w):
    """lags: (E, 6) most recent first -> predicted ratios (E, 6)."""
    X = _feat(lags, np.full(len(lags), hour), w)
    return np.clip(lags[:, [0]] + X @ B, MIN_RATIO, 1)


def load_or_train(R, hours, w, free, path):
    sig = f"{len(w)}:{float(w.sum()):.4f}:{float(free.sum()):.1f}:{R.shape[0]}"
    if os.path.exists(path):
        try:
            z = np.load(path, allow_pickle=False)
            if str(z["sig"]) == sig:
                return dict(B=z["B"], metrics=json.loads(str(z["metrics"])), cached=True)
        except Exception:
            pass
    B, m = train(R, hours, w, free)
    try:
        np.savez(path, B=B, sig=sig, metrics=json.dumps(m))
    except OSError:
        pass
    return dict(B=B, metrics=m, cached=False)
