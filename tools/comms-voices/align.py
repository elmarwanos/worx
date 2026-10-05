"""Word timings for the Comms highlight, by forced alignment.

Whisper (build.py) gives each word's time to within ~0.1 s either way;
the highlight wants better. This aligns the audio of each testimonial
against exactly what was said, character by character (torchaudio's
wav2vec2 ASR base 960h + forced_align, ~20 ms), and rewrites WORDS in
cues.json.

SPOKEN lists, per card word, how it sounds spelled out for the English
model (WORX -> WORKS, CHAUMET -> SHOW MAY, UAE -> U A E ...); words the
actor added that the card doesn't have are attached to the card word
before them, so its highlight holds through them.

Run after build.py: <venv with torch 2.2 + torchaudio 2.2>/bin/python tools/comms-voices/align.py
"""
import os, json, re
import numpy as np
import torch, torchaudio
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = {"worx": "WORKS", "chaumet": "SHOW MAY", "uae": "U A E", "gcc": "G C C", "ecommerce": "E COMMERCE", "we've": "WE'VE"}
EXTRA = {"q0": {"professional": ["AND"]}}   # card word -> words spoken after it that the card doesn't have
CARDS = {
    "q0": "We've been working with the Worx team for over two years and their work is professional with impressive speed!",
    "q1": "The team understands the requirements of the UAE and GCC region which made the Chaumet e-commerce website a huge success! Kudos to everyone at Worx.",
    "q2": "I have worked with Glimpse on various real estate projects and they continue to exceed expectations. Worx is our trusted partner.",
}

bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
model = bundle.get_model().eval()
labels = bundle.get_labels()
idx = {c: i for i, c in enumerate(labels)}

d = json.load(open(os.path.join(HERE, "cues.json")))
sr, x = wavfile.read(os.path.join(HERE, "comms-cast.wav"))
x = x.astype(np.float32) / 32768

for k, text in CARDS.items():
    a, l = d["CUES"][k]
    seg = torch.from_numpy(x[int(a * sr):int((a + l) * sr)].copy())[None]
    seg = torchaudio.functional.resample(seg, sr, bundle.sample_rate)
    with torch.inference_mode():
        em, _ = model(seg)
        em = torch.log_softmax(em, -1)
    # the spoken words, each tagged with its card word
    spoken = []
    for ci, cw in enumerate(text.split()):
        key = re.sub(r"[^a-z']", "", cw.lower().replace("-", ""))
        for sw in SOUNDS.get(key, re.sub(r"[^A-Z']", "", cw.upper())).split():
            spoken.append((ci, sw))
        for sw in EXTRA.get(k, {}).get(key, []):
            spoken.append((ci, sw))
    chars, owner = [], []
    for si, (ci, sw) in enumerate(spoken):
        for ch in sw:
            chars.append(idx[ch]); owner.append(si)
    tgt = torch.tensor([chars], dtype=torch.int32)
    ali, scores = torchaudio.functional.forced_align(em, tgt, blank=0)
    spans = torchaudio.functional.merge_tokens(ali[0], scores[0].exp())   # one span per target char, in order
    assert len(spans) == len(chars), (k, len(spans), len(chars))
    fps = em.shape[1] / (seg.shape[1] / bundle.sample_rate)        # emission frames per second
    # per spoken word, then per card word
    sw_span = {}
    for sp, si in zip(spans, owner):
        s0, s1 = sw_span.get(si, (sp.start, sp.end))
        sw_span[si] = (min(s0, sp.start), max(s1, sp.end - 1))
    n = len(text.split())
    out = [None] * n
    for si, (ci, _) in enumerate(spoken):
        if si not in sw_span: continue
        f0, f1 = sw_span[si]
        t0, t1 = f0 / fps, (f1 + 1) / fps
        out[ci] = [t0, t1] if out[ci] is None else [min(out[ci][0], t0), max(out[ci][1], t1)]
    # a word runs until the next begins (the highlight never goes dark mid-sentence)
    for i in range(n - 1):
        if out[i] and out[i + 1] and out[i + 1][0] - out[i][1] < 0.25: out[i][1] = out[i + 1][0]
    old = d["WORDS"][k]
    d["WORDS"][k] = [[round(max(0, t0 - 0.02), 3), round(t1, 3)] for t0, t1 in out]
    diffs = [abs(o[0] - w[0]) * 1000 for o, w in zip(old, d["WORDS"][k])]
    print(k, n, "words aligned; vs whisper: median %.0f ms, max %.0f ms" % (np.median(diffs), max(diffs)))
json.dump(d, open(os.path.join(HERE, "cues.json"), "w"), indent=1)
