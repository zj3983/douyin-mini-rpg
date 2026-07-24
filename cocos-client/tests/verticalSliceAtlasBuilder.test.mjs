import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function runPython(script, args = []) {
  const result = spawnSync('python', ['-c', script, resolve('.'), ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout || result.stderr)
  return result.stdout
}

test('builder normalizes a subject into a 4:5 frame without touching the safe edge', () => {
  const script = String.raw`
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

image = Image.new("RGBA", (180, 220), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rectangle((54, 36, 126, 198), fill=(90, 180, 140, 255))
frame = builder.normalize_frame(image, (256, 320), 0.10, {"x": 0.5, "y": 0.86})
builder.validate_subject(frame, 0.10)
print(frame.size, frame.getchannel("A").getbbox())
`
  const output = runPython(script)
  assert.match(output, /\(256, 320\)/)
})

test('builder packs synthetic actions and writes byte-identical manifests', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-atlas-'))
  try {
    const script = String.raw`
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

source_root = temp / "source"
output_root = temp / "resources"
for index in range(3):
    path = source_root / "test-actor" / "idle" / f"{index:02d}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((36 + index * 3, 30, 92 + index * 3, 138), fill=(80 + index * 30, 130, 210, 255))
    image.save(path)

actor = builder.build_actor({
    "id": "test-actor",
    "type": "monster",
    "masterFrameSize": [128, 160],
    "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85},
    "actions": {"idle": {"frames": 3, "fps": 6, "loop": True, "source": "test-actor/idle"}}
}, source_root, output_root)
source_manifest = temp / "animation-atlas.json"
resource_manifest = temp / "resources-animation-atlas.json"
builder.write_manifest([actor], source_manifest, resource_manifest)
print(json.dumps({
    "atlas": actor["atlas"],
    "frameSize": actor["frameSize"],
    "frames": len(actor["actions"][0]["frames"]),
    "same": source_manifest.read_bytes() == resource_manifest.read_bytes(),
}))
`
    const output = runPython(script, [tempRoot])
    const parsed = JSON.parse(output)
    assert.deepEqual(parsed.frameSize, { w: 64, h: 80 })
    assert.equal(parsed.frames, 3)
    assert.equal(parsed.same, true)
    assert.ok(readFileSync(join(tempRoot, 'resources', parsed.atlas)).length > 0)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('builder command line check validates the checked-in source manifest', () => {
  const result = spawnSync('python', ['tools/build-vertical-slice-atlases.py', '--check'], {
    cwd: resolve('.'),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stdout || result.stderr)
  assert.match(result.stdout, /vertical slice atlas source manifest ok/)
})

test('builder rejects invalid production source contracts', () => {
  const script = String.raw`
import copy
import importlib.util
import json
import sys
from pathlib import Path

repo = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", repo / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

base = {
    "version": 2,
    "actors": {
        "test-actor": {
            "masterFrameSize": [128, 160],
            "runtimeFrameSize": [64, 80],
            "quality": {
                "maxCenterDrift": 0.08,
                "maxScaleDrift": 0.12,
                "minAlphaCoverage": 0.02,
                "maxAlphaCoverage": 0.72,
                "safePadding": 0.08,
            },
            "actions": {
                "idle": {
                    "frames": 3,
                    "fps": 6,
                    "loop": True,
                    "source": "test-actor/idle",
                    "sourceMode": "frame-sequence",
                    "events": [{"name": "ready", "time": 0.5}],
                }
            },
        }
    },
}

manifest_path = temp / "assets" / "Data" / "vertical-slice-animation-sources.json"
manifest_path.parent.mkdir(parents=True, exist_ok=True)

def rejected(mutator):
    data = copy.deepcopy(base)
    mutator(data)
    manifest_path.write_text(json.dumps(data), encoding="utf-8")
    try:
        builder.check_source_manifest(temp)
    except ValueError:
        return True
    return False

actor = lambda data: data["actors"]["test-actor"]
action = lambda data: actor(data)["actions"]["idle"]
cases = [
    ("wrong version", lambda data: data.update(version=1)),
    ("missing quality", lambda data: actor(data).pop("quality")),
    ("missing quality key", lambda data: actor(data)["quality"].pop("safePadding")),
    ("non-numeric quality", lambda data: actor(data)["quality"].update(maxCenterDrift="0.08")),
    ("unsupported source mode", lambda data: action(data).update(sourceMode="sprite-sheet")),
    ("zero frames", lambda data: action(data).update(frames=0)),
    ("too many frames", lambda data: action(data).update(frames=17)),
    ("zero fps", lambda data: action(data).update(fps=0)),
    ("too much fps", lambda data: action(data).update(fps=25)),
    ("empty event name", lambda data: action(data).update(events=[{"name": "", "time": 0.5}])),
    ("unsorted events", lambda data: action(data).update(events=[{"name": "late", "time": 0.7}, {"name": "early", "time": 0.2}])),
    ("duplicate event times", lambda data: action(data).update(events=[{"name": "one", "time": 0.4}, {"name": "two", "time": 0.4}])),
    ("event at zero", lambda data: action(data).update(events=[{"name": "zero", "time": 0}])),
    ("event at one", lambda data: action(data).update(events=[{"name": "one", "time": 1}])),
]

failed = [label for label, mutate in cases if not rejected(mutate)]
if failed:
    raise AssertionError(f"builder accepted invalid contracts: {failed}")

manifest_path.write_text(json.dumps(base), encoding="utf-8")
builder.check_source_manifest(temp)
print("all invalid contracts rejected")
`
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-contract-'))
  try {
    assert.match(runPython(script, [tempRoot]), /all invalid contracts rejected/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
