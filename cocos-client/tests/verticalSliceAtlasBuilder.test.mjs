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
    "quality": {
        "maxCenterDrift": 0.08,
        "maxScaleDrift": 0.12,
        "minAlphaCoverage": 0.02,
        "maxAlphaCoverage": 0.72,
        "safePadding": 0.08,
    },
    "actions": {"idle": {
        "frames": 3,
        "fps": 6,
        "loop": True,
        "source": "test-actor/idle",
        "sourceMode": "frame-sequence",
        "order": [0, 0, 2, 1],
    }}
}, source_root, output_root, temp / "reports")
source_manifest = temp / "animation-atlas.json"
resource_manifest = temp / "resources-animation-atlas.json"
builder.write_manifest([actor], source_manifest, resource_manifest)
report_data = json.loads((temp / "reports/test-actor-report.json").read_text(encoding="utf-8"))
print(json.dumps({
    "atlas": actor["atlas"],
    "frameSize": actor["frameSize"],
    "frames": len(actor["actions"][0]["frames"]),
    "order": actor["actions"][0]["order"],
    "duration": len(actor["actions"][0]["order"]) / actor["actions"][0]["fps"],
    "same": source_manifest.read_bytes() == resource_manifest.read_bytes(),
    "report": (temp / "reports/test-actor-report.json").exists(),
    "sheet": (temp / "reports/test-actor-contact-sheet.png").exists(),
    "contactSheets": len(list((temp / "reports").glob("*-contact-sheet.png"))),
    "sourceFrames": report_data["actions"]["idle"]["sourceMetrics"]["frameCount"],
    "sourceUniqueFrames": report_data["actions"]["idle"]["sourceMetrics"]["uniqueFrameCount"],
    "packedSourceFrames": report_data["actions"]["idle"]["packedSourceQualityMetrics"]["frameCount"],
    "runtimeFrames": report_data["actions"]["idle"]["runtimeMetrics"]["frameCount"],
    "reportOrder": report_data["actions"]["idle"]["playbackOrder"],
}))
`
    const output = runPython(script, [tempRoot])
    const parsed = JSON.parse(output)
    assert.deepEqual(parsed.frameSize, { w: 64, h: 80 })
    assert.equal(parsed.frames, 3)
    assert.deepEqual(parsed.order, [0, 0, 2, 1])
    assert.equal(parsed.duration, 4 / 6)
    assert.equal(parsed.same, true)
    assert.equal(parsed.report, true)
    assert.equal(parsed.sheet, true)
    assert.equal(parsed.contactSheets, 1)
    assert.equal(parsed.sourceFrames, 4)
    assert.equal(parsed.sourceUniqueFrames, 3)
    assert.equal(parsed.packedSourceFrames, 3)
    assert.equal(parsed.runtimeFrames, 4)
    assert.deepEqual(parsed.reportOrder, [0, 0, 2, 1])
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
        "id": "test-actor",
        "folder": "TestActor",
        "masterFrameSize": [128, 160],
            "runtimeFrameSize": [64, 80],
            "anchor": {"x": 0.5, "y": 0.85},
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
    except Exception as error:
        return f"wrong exception {type(error).__name__}"
    return False

actor = lambda data: data["actors"]["test-actor"]
action = lambda data: actor(data)["actions"]["idle"]
cases = [
    ("wrong version", lambda data: data.update(version=1)),
    ("actor not object", lambda data: data["actors"].update({"test-actor": []})),
    ("missing actor id", lambda data: actor(data).pop("id")),
    ("mismatched actor id", lambda data: actor(data).update(id="other-actor")),
    ("empty folder", lambda data: actor(data).update(folder="")),
    ("non-string folder", lambda data: actor(data).update(folder=123)),
    ("traversal folder", lambda data: actor(data).update(folder="../escape")),
    ("dot folder", lambda data: actor(data).update(folder=".")),
    ("dot-dot folder", lambda data: actor(data).update(folder="..")),
    ("absolute folder", lambda data: actor(data).update(folder="/absolute")),
    ("windows absolute folder", lambda data: actor(data).update(folder="C:/absolute")),
    ("slash folder", lambda data: actor(data).update(folder="Nested/Actor")),
    ("backslash folder", lambda data: actor(data).update(folder="Nested\\Actor")),
    ("colon folder", lambda data: actor(data).update(folder="Actor:Alt")),
    ("reserved con folder", lambda data: actor(data).update(folder="CON")),
    ("reserved prn folder", lambda data: actor(data).update(folder="prn")),
    ("reserved aux folder", lambda data: actor(data).update(folder="AUX")),
    ("reserved nul folder", lambda data: actor(data).update(folder="nul")),
    ("reserved com folder", lambda data: actor(data).update(folder="COM1")),
    ("reserved lpt folder", lambda data: actor(data).update(folder="LPT1")),
    ("traversal actor id", lambda data: data["actors"].update({"../escape": {**data["actors"].pop("test-actor"), "id": "../escape"}})),
    ("backslash actor id", lambda data: data["actors"].update({"bad\\name": {**data["actors"].pop("test-actor"), "id": "bad\\name"}})),
    ("colon actor id", lambda data: data["actors"].update({"bad:name": {**data["actors"].pop("test-actor"), "id": "bad:name"}})),
    ("reserved con actor id", lambda data: data["actors"].update({"con": {**data["actors"].pop("test-actor"), "id": "con"}})),
    ("reserved prn actor id", lambda data: data["actors"].update({"prn": {**data["actors"].pop("test-actor"), "id": "prn"}})),
    ("reserved com actor id", lambda data: data["actors"].update({"com1": {**data["actors"].pop("test-actor"), "id": "com1"}})),
    ("reserved lpt actor id", lambda data: data["actors"].update({"lpt1": {**data["actors"].pop("test-actor"), "id": "lpt1"}})),
    ("missing quality", lambda data: actor(data).pop("quality")),
    ("missing quality key", lambda data: actor(data)["quality"].pop("safePadding")),
    ("non-numeric quality", lambda data: actor(data)["quality"].update(maxCenterDrift="0.08")),
    ("negative quality", lambda data: actor(data)["quality"].update(maxCenterDrift=-0.01)),
    ("quality above one", lambda data: actor(data)["quality"].update(maxScaleDrift=1.01)),
    ("negative safe padding", lambda data: actor(data)["quality"].update(safePadding=-0.01)),
    ("safe padding at upper bound", lambda data: actor(data)["quality"].update(safePadding=0.4)),
    ("inverted alpha coverage", lambda data: actor(data)["quality"].update(minAlphaCoverage=0.8, maxAlphaCoverage=0.7)),
    ("missing source", lambda data: action(data).pop("source")),
    ("empty source", lambda data: action(data).update(source="  ")),
    ("absolute source", lambda data: action(data).update(source="/actors/test")),
    ("windows absolute source", lambda data: action(data).update(source="C:/actors/test")),
    ("traversal source", lambda data: action(data).update(source="test-actor/../secret")),
    ("string loop", lambda data: action(data).update(loop="true")),
    ("missing anchor", lambda data: actor(data).pop("anchor")),
    ("invalid anchor coordinate", lambda data: actor(data).update(anchor={"x": 1.1, "y": 0.85})),
    ("non-numeric anchor coordinate", lambda data: actor(data).update(anchor={"x": "0.5", "y": 0.85})),
    ("string dimension", lambda data: actor(data).update(masterFrameSize=["128", 160])),
    ("float dimension", lambda data: actor(data).update(runtimeFrameSize=[64.0, 80])),
    ("boolean dimension", lambda data: actor(data).update(runtimeFrameSize=[True, 80])),
    ("unsupported source mode", lambda data: action(data).update(sourceMode="sprite-sheet")),
    ("zero frames", lambda data: action(data).update(frames=0)),
    ("too many frames", lambda data: action(data).update(frames=17)),
    ("zero fps", lambda data: action(data).update(fps=0)),
    ("too much fps", lambda data: action(data).update(fps=25)),
    ("order not list", lambda data: action(data).update(order="0,1")),
    ("empty order", lambda data: action(data).update(order=[])),
    ("too long order", lambda data: action(data).update(order=[0] * 17)),
    ("float order index", lambda data: action(data).update(order=[0, 1.0])),
    ("boolean order index", lambda data: action(data).update(order=[0, True])),
    ("negative order index", lambda data: action(data).update(order=[-1, 0])),
    ("order index beyond frames", lambda data: action(data).update(order=[0, 3])),
    ("empty event name", lambda data: action(data).update(events=[{"name": "", "time": 0.5}])),
    ("unsorted events", lambda data: action(data).update(events=[{"name": "late", "time": 0.7}, {"name": "early", "time": 0.2}])),
    ("duplicate event times", lambda data: action(data).update(events=[{"name": "one", "time": 0.4}, {"name": "two", "time": 0.4}])),
    ("event at zero", lambda data: action(data).update(events=[{"name": "zero", "time": 0}])),
    ("event at one", lambda data: action(data).update(events=[{"name": "one", "time": 1}])),
]

failed = []
for label, mutate in cases:
    result = rejected(mutate)
    if result is not True:
        failed.append(f"{label} ({result})")
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

test('build_actor contains configured folders beneath the actor atlas root', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-folder-safety-'))
  try {
    const script = String.raw`
import copy
import importlib.util
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

base = {
    "id": "test-actor",
    "type": "monster",
    "folder": "TestActor",
    "masterFrameSize": [128, 160],
    "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85},
    "quality": {
        "maxCenterDrift": 0.08,
        "maxScaleDrift": 0.12,
        "minAlphaCoverage": 0.02,
        "maxAlphaCoverage": 0.72,
        "safePadding": 0.08,
    },
    "actions": {"idle": {
        "frames": 1,
        "fps": 6,
        "loop": True,
        "source": "test-actor/idle",
        "sourceMode": "frame-sequence",
    }},
}

unsafe = [
    "", 123, "../escape", ".", "..", "/absolute", "C:/absolute",
    "Nested/Actor", "Nested\\Actor", "Actor:Alt",
    "CON", "prn", "AUX", "nul", "COM1", "LPT1",
]
output_root = temp / "runtime"
for folder in unsafe:
    config = copy.deepcopy(base)
    config["folder"] = folder
    try:
        builder.build_actor(config, temp / "missing-source", output_root)
    except ValueError as error:
        assert "folder" in str(error), f"{folder}: {error}"
    else:
        raise AssertionError(f"unsafe folder accepted: {folder}")

actor_root = (output_root / "Assets/ActorAtlases").resolve()
outside = (output_root / "Assets/escape").resolve()
assert not outside.exists()
if actor_root.exists():
    assert list(actor_root.iterdir()) == []
print("unsafe actor folders contained")
`
    assert.match(runPython(script, [tempRoot]), /unsafe actor folders contained/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('builder analyzes deterministic action quality and rejects unstable frames', () => {
  const script = String.raw`
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

quality = {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08,
}

def make_frame(bounds, size=(100, 100)):
    frame = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle(bounds, fill=(120, 210, 180, 255))
    return frame

stable = [
    make_frame((30, 20, 69, 79)),
    make_frame((31, 20, 70, 79)),
    make_frame((29, 20, 68, 79)),
]
metrics = builder.analyze_action(stable, quality)
assert metrics["frameCount"] == 3
assert metrics["centerDrift"] < quality["maxCenterDrift"]
assert metrics["scaleDrift"] == 0
assert metrics["frames"][0]["bounds"] == [30, 20, 70, 80]
assert metrics["frames"][0]["center"] == [0.5, 0.5]
assert metrics["frames"][0]["scale"] == [0.4, 0.6]
assert metrics["frames"][0]["edgeMargins"] == [0.3, 0.2, 0.3, 0.2]

speckled = make_frame((30, 20, 69, 79))
speckled.putpixel((0, 0), (255, 255, 255, 1))
speckled_metrics = builder.frame_metrics(speckled)
assert speckled_metrics["bounds"] == [30, 20, 70, 80]
assert speckled_metrics["edgeMargins"] == [0.3, 0.2, 0.3, 0.2]
assert speckled_metrics["alphaCoverage"] == metrics["frames"][0]["alphaCoverage"]

def expect_rejected(label, frames, expected, custom_quality=None, validation="source"):
    try:
        builder.analyze_action(frames, custom_quality or quality, validation=validation)
    except ValueError as error:
        assert expected in str(error), f"{label}: {error}"
    else:
        raise AssertionError(f"{label} must fail")

expect_rejected("empty", [], "empty")
expect_rejected("invisible", [Image.new("RGBA", (100, 100), (0, 0, 0, 0))], "visible")
expect_rejected("safe edge", [make_frame((0, 20, 39, 79))], "safe edge", validation="runtime")
expect_rejected("center drift", [make_frame((10, 20, 39, 79)), make_frame((60, 20, 89, 79))], "center drift")
expect_rejected("scale drift", [make_frame((30, 20, 69, 79)), make_frame((20, 10, 79, 89))], "scale drift")
intentional_motion = [
    make_frame((15 + index * 2, 35 - index * 2, 84 - index * 2, 64 + index * 2))
    for index in range(8)
]
intentional_metrics = builder.analyze_action(intentional_motion, quality, validation="source")
assert intentional_metrics["scaleDrift"] == 0
assert intentional_metrics["intentionalScaleAxes"] == [0, 1]
assert builder._exceeds_quality_limit(0.1749, 0.17) is False
assert builder._exceeds_quality_limit(0.1751, 0.17) is True
expect_rejected("low alpha", [make_frame((48, 48, 51, 51))], "alpha coverage", {**quality, "safePadding": 0.01})
expect_rejected("high alpha", [make_frame((5, 5, 94, 94))], "alpha coverage", {**quality, "safePadding": 0.01})
print(json.dumps(metrics, sort_keys=True))
`
  const output = runPython(script)
  const metrics = JSON.parse(output)
  assert.equal(metrics.frameCount, 3)
})

test('source crop validation tolerates antialiased edge hairs but rejects substantive clipping', () => {
  const script = String.raw`
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path.cwd()
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
quality = dict(builder.DEFAULT_QUALITY)

def base_frame():
    frame = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle((55, 35, 144, 174), fill=(120, 200, 160, 255))
    return frame

hair = base_frame()
for point in ((0, 90), (0, 91), (199, 112)):
    hair.putpixel(point, (120, 200, 160, 8))
# A short antialiased fur fringe may occupy several pixels while remaining a
# negligible fraction of the subject and less than ten percent of the edge.
for y in range(92, 108):
    hair.putpixel((0, y), (120, 200, 160, 8))
metrics = builder.analyze_action([hair], quality, validation="source", context="qinglan/idle")
assert metrics["frames"][0]["borderContact"]["visibleRatio"] < builder.SOURCE_BORDER_VISIBLE_RATIO_LIMIT

clipped = base_frame()
ImageDraw.Draw(clipped).rectangle((0, 60, 30, 139), fill=(120, 200, 160, 255))
try:
    builder.analyze_action([clipped], quality, validation="source", context="moss-wolf/attack")
except ValueError as error:
    message = str(error)
    assert "moss-wolf/attack frame 0" in message
    assert "source border contact" in message
else:
    raise AssertionError("substantive source clipping must fail")

try:
    builder.analyze_action([clipped], quality, validation="runtime", context="moss-wolf/attack")
except ValueError as error:
    assert "safe edge" in str(error)
else:
    raise AssertionError("runtime frames must keep full safe padding validation")
print(json.dumps(metrics["frames"][0]["borderContact"], sort_keys=True))
`
  const result = JSON.parse(runPython(script))
  assert.equal(result.visiblePixels, 19)
})

test('action quality overrides are restricted merged and reported', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-action-quality-'))
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

def actor(override):
    return {
        "id": "test-actor", "type": "monster", "masterFrameSize": [128, 160],
        "runtimeFrameSize": [64, 80], "anchor": {"x": 0.5, "y": 0.85},
        "quality": dict(builder.DEFAULT_QUALITY),
        "actions": {"attack": {
            "frames": 2, "fps": 8, "loop": False, "source": "test-actor/attack",
            "sourceMode": "frame-sequence", "quality": override,
        }},
    }

for override, expected in (
    ({"safePadding": 0.01}, "only override"),
    ({"maxScaleDrift": "0.2"}, "numeric"),
    ({"maxCenterDrift": -0.1}, "[0, 1]"),
    ({"maxScaleDrift": 1.1}, "[0, 1]"),
):
    try:
        builder._validate_action("test-actor", "attack", actor(override)["actions"]["attack"])
    except ValueError as error:
        assert expected in str(error), error
    else:
        raise AssertionError(f"invalid override accepted: {override}")

source = temp / "source/test-actor/attack"
source.mkdir(parents=True)
for index, box in enumerate(((35, 30, 84, 129), (27, 22, 92, 137))):
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle(box, fill=(120, 200, 160, 255))
    image.save(source / f"{index:02d}.png")

config = actor({"maxScaleDrift": 0.40})
builder.build_actor(config, temp / "source", temp / "output", temp / "reports")
report = json.loads((temp / "reports/test-actor-report.json").read_text(encoding="utf-8"))
effective = report["actions"]["attack"]["effectiveQuality"]
assert effective == {**builder.DEFAULT_QUALITY, "maxScaleDrift": 0.40}
print(json.dumps(effective, sort_keys=True))
`
    const result = JSON.parse(runPython(script, [tempRoot]))
    assert.equal(result.maxScaleDrift, 0.4)
    assert.equal(result.safePadding, 0.08)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('build_actor rejects raw source defects before normalization can hide them', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-raw-quality-'))
  try {
    const script = String.raw`
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

quality = {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08,
}

def write_frames(case_name, bounds):
    source = temp / case_name / "source" / "test-actor" / "idle"
    source.mkdir(parents=True, exist_ok=True)
    for index, box in enumerate(bounds):
        image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
        ImageDraw.Draw(image).rectangle(box, fill=(100, 190, 150, 255))
        image.save(source / f"{index:02d}.png")

def build(case_name):
    case = temp / case_name
    return builder.build_actor({
        "id": "test-actor",
        "type": "monster",
        "masterFrameSize": [128, 160],
        "runtimeFrameSize": [64, 80],
        "anchor": {"x": 0.5, "y": 0.85},
        "quality": quality,
        "actions": {"idle": {
            "frames": 2,
            "fps": 6,
            "loop": True,
            "source": "test-actor/idle",
            "sourceMode": "frame-sequence",
        }},
    }, case / "source", case / "output", case / "reports")

cases = {
    "edge": ([(0, 30, 49, 129), (0, 30, 49, 129)], "source border contact"),
    "position": ([(15, 30, 54, 129), (73, 30, 112, 129)], "center drift"),
    "size": ([(42, 35, 85, 124), (25, 18, 102, 141)], "scale drift"),
}
for name, (bounds, expected) in cases.items():
    write_frames(name, bounds)
    try:
        build(name)
    except ValueError as error:
        assert expected in str(error), f"{name}: {error}"
    else:
        raise AssertionError(f"raw {name} defect was hidden by normalization")
print("raw source defects rejected")
`
    assert.match(runPython(script, [tempRoot]), /raw source defects rejected/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('builder writes a candidate JSON report and openable contact sheet', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-report-'))
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

def make_frame(offset, color):
    frame = Image.new("RGBA", (64, 80), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle((18 + offset, 12, 45 + offset, 67), fill=color)
    return frame

quality = {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08,
}
action_frames = {
    "idle": [make_frame(0, (80, 170, 220, 255)), make_frame(1, (90, 180, 230, 255))],
    "cast": [make_frame(0, (220, 170, 80, 255)), make_frame(-1, (230, 180, 90, 255))],
}
action_metrics = {name: builder.analyze_action(frames, quality) for name, frames in action_frames.items()}
report = builder.write_actor_report(
    actor_id="test-actor",
    source_modes={"idle": "frame-sequence", "cast": "layered-keyframes"},
    action_frames=action_frames,
    source_metrics=action_metrics,
    runtime_metrics=action_metrics,
    atlas_dimensions={"idle": [128, 80], "cast": [128, 80]},
    warnings=["review cast silhouette"],
    report_root=temp,
)
report_path = temp / "test-actor-report.json"
sheet_path = temp / "test-actor-contact-sheet.png"
stored = json.loads(report_path.read_text(encoding="utf-8"))
with Image.open(sheet_path) as sheet:
    sheet_size = sheet.size
assert report == stored
assert stored["status"] == "candidate"
assert stored["actorId"] == "test-actor"
assert stored["sourceModes"]["cast"] == "layered-keyframes"
assert stored["actions"]["idle"]["sourceMetrics"]["frameCount"] == 2
assert stored["actions"]["idle"]["runtimeMetrics"]["frameCount"] == 2
assert stored["atlasDimensions"]["idle"] == [128, 80]
assert stored["warnings"] == ["review cast silhouette"]
assert sheet_size[0] > 0 and sheet_size[1] > 0
print(json.dumps({"sheetSize": sheet_size, "report": stored}, sort_keys=True))
`
    const output = runPython(script, [tempRoot])
    const parsed = JSON.parse(output)
    assert.ok(parsed.sheetSize[0] > 0)
    assert.ok(parsed.sheetSize[1] > 0)
    assert.equal(parsed.report.status, 'candidate')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('contact sheets bound large frames, stay deterministic, and enforce path and pixel budgets', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-report-safety-'))
  try {
    const script = String.raw`
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

large = Image.new("RGBA", (1000, 1250), (0, 0, 0, 0))
ImageDraw.Draw(large).rectangle((200, 100, 799, 1149), fill=(80, 180, 220, 255))
frames = {"idle": [large, large], "cast": [large, large]}
first = temp / "first.png"
second = temp / "second.png"
builder.write_contact_sheet(frames, first)
builder.write_contact_sheet(frames, second)
with Image.open(first) as sheet:
    assert sheet.size == (456, 432)
assert first.read_bytes() == second.read_bytes()

try:
    builder._report_output_path(temp / "reports", "../escape.json")
except ValueError as error:
    assert "report root" in str(error)
else:
    raise AssertionError("resolved report output must stay inside report root")

too_many = {f"action-{index}": [large] * 100 for index in range(100)}
try:
    builder.write_contact_sheet(too_many, temp / "too-large.png")
except ValueError as error:
    assert "pixel budget" in str(error)
else:
    raise AssertionError("oversized contact sheet layout must fail")

try:
    builder.write_actor_report(
        actor_id="../escape",
        source_modes={"idle": "frame-sequence"},
        action_frames={"idle": [large]},
        source_metrics={"idle": {}},
        runtime_metrics={"idle": {}},
        atlas_dimensions={"idle": [64, 80]},
        warnings=[],
        report_root=temp / "reports",
    )
except ValueError as error:
    assert "actor id" in str(error)
else:
    raise AssertionError("unsafe report actor id must fail")
assert not (temp / "escape-report.json").exists()
print("bounded deterministic and safe")
`
    assert.match(runPython(script, [tempRoot]), /bounded deterministic and safe/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('mobile atlas packing enforces 2048 and runtime metadata retains validated events', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-mobile-budget-'))
  try {
    const script = String.raw`
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

frames = [Image.new("RGBA", (512, 640), (60, 120, 180, 255)) for _ in range(13)]
try:
    builder.pack_action(frames, (512, 640))
except ValueError as error:
    assert "2048" in str(error) or "texture" in str(error)
else:
    raise AssertionError("atlas larger than 2048 must fail")

source = temp / "source/test-actor/cast"
source.mkdir(parents=True)
for index in range(2):
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((38 + index, 24, 89 + index, 139), fill=(80, 170, 220, 255))
    image.save(source / f"{index:02d}.png")
actor = builder.build_actor({
    "id": "test-actor",
    "type": "character",
    "masterFrameSize": [128, 160],
    "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85},
    "quality": builder.DEFAULT_QUALITY,
    "actions": {"cast": {
        "frames": 2, "fps": 8, "loop": False,
        "source": "test-actor/cast", "sourceMode": "layered-keyframes",
        "events": [{"name": "sword-release", "time": 0.42}],
    }},
}, temp / "source", temp / "output")
assert actor["actions"][0]["events"] == [{"name": "sword-release", "at": 0.42}]
print("budget and events ok")
`
    assert.match(runPython(script, [tempRoot]), /budget and events ok/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('candidate builds are isolated and promotion is selective, atomic, and status-aware', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-atomic-'))
  try {
    const script = String.raw`
import hashlib
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

def write_action(actor_id, action="idle", frames=2, valid=True):
    directory = temp / "source" / actor_id / action
    directory.mkdir(parents=True, exist_ok=True)
    count = frames if valid else frames - 1
    for index in range(count):
        image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
        ImageDraw.Draw(image).rectangle((38 + index, 24, 89 + index, 139), fill=(80, 170, 220, 255))
        image.save(directory / f"{index:02d}.png")

def actor(actor_id, folder):
    return {
        "id": actor_id, "folder": folder, "type": "monster",
        "masterFrameSize": [128, 160], "runtimeFrameSize": [64, 80],
        "anchor": {"x": 0.5, "y": 0.85}, "quality": builder.DEFAULT_QUALITY,
        "actions": {"idle": {
            "frames": 2, "fps": 6, "loop": True,
            "source": f"{actor_id}/idle", "sourceMode": "frame-sequence",
            "events": [{"name": "ready", "time": 0.5}],
        }},
    }

write_action("alpha", valid=True)
write_action("beta", valid=False)
data = {"version": 2, "actors": {"alpha": actor("alpha", "Alpha"), "beta": actor("beta", "Beta")}}
runtime = temp / "runtime"
source_manifest = temp / "assets/Data/animation-atlas.json"
resource_manifest = temp / "assets/resources/Data/animation-atlas.json"
candidate_root = temp / "artifacts/animation-candidates"
report_sentinel = candidate_root / "alpha/reports/alpha-report.json"
runtime_png = runtime / "Assets/ActorAtlases/Alpha/idle.png"
unrelated_png = runtime / "Assets/ActorAtlases/Legacy/idle.png"
for path, payload in ((report_sentinel, b"report-sentinel"), (runtime_png, b"runtime-sentinel"), (unrelated_png, b"legacy-sentinel")):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
existing = {
    "version": 2,
    "framePacking": "vertical-slice-action-atlases",
    "actors": [
        {"id": "alpha", "type": "monster", "atlas": "Assets/ActorAtlases/Alpha/idle.png", "frameSize": {"w": 1, "h": 1}, "actions": []},
        {"id": "legacy", "type": "monster", "atlas": "Assets/ActorAtlases/Legacy/idle.png", "frameSize": {"w": 1, "h": 1}, "actions": []},
    ],
}
payload = (json.dumps(existing, ensure_ascii=False, indent=2) + "\n").encode()
source_manifest.parent.mkdir(parents=True)
resource_manifest.parent.mkdir(parents=True)
source_manifest.write_bytes(payload)
resource_manifest.write_bytes(payload)

watched = [report_sentinel, runtime_png, unrelated_png, source_manifest, resource_manifest]
before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
try:
    builder.promote_selected_actors(
        data, ["alpha", "beta"], temp / "source", candidate_root,
        runtime, source_manifest, resource_manifest,
    )
except FileNotFoundError:
    pass
else:
    raise AssertionError("failed multi-actor promotion must fail")
after = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
assert before == after

candidate = builder.build_candidate_actors(data, ["alpha"], temp / "source", candidate_root)
assert candidate[0]["id"] == "alpha"
assert runtime_png.read_bytes() == b"runtime-sentinel"
assert source_manifest.read_bytes() == payload == resource_manifest.read_bytes()
candidate_report = json.loads(report_sentinel.read_text(encoding="utf-8"))
assert candidate_report["status"] == "candidate"

builder.promote_selected_actors(
    data, ["alpha"], temp / "source", candidate_root,
    runtime, source_manifest, resource_manifest,
)
assert runtime_png.read_bytes() != b"runtime-sentinel"
assert unrelated_png.read_bytes() == b"legacy-sentinel"
assert source_manifest.read_bytes() == resource_manifest.read_bytes()
promoted = json.loads(source_manifest.read_text(encoding="utf-8"))
assert [entry["id"] for entry in promoted["actors"]] == ["alpha", "legacy"]
assert promoted["actors"][1] == existing["actors"][1]
assert promoted["actors"][0]["actions"][0]["events"] == [{"name": "ready", "at": 0.5}]
approved_report = json.loads(report_sentinel.read_text(encoding="utf-8"))
assert approved_report["status"] == "approved"

assert builder.select_actor_ids(data, []) == ["alpha", "beta"]
for invalid in (["unknown"], ["alpha", "alpha"], [""]):
    try:
        builder.select_actor_ids(data, invalid)
    except ValueError:
        pass
    else:
        raise AssertionError(f"invalid selection accepted: {invalid}")
print("atomic candidate promotion ok")
`
    assert.match(runPython(script, [tempRoot]), /atomic candidate promotion ok/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('folder collisions are rejected with both actor ids before promotion mutates runtime', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-folder-collision-'))
  try {
    const script = String.raw`
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

def actor(actor_id, folder):
    return {
        "id": actor_id,
        "folder": folder,
        "type": "monster",
        "masterFrameSize": [128, 160],
        "runtimeFrameSize": [64, 80],
        "anchor": {"x": 0.5, "y": 0.85},
        "quality": builder.DEFAULT_QUALITY,
        "actions": {"idle": {
            "frames": 1,
            "fps": 6,
            "loop": True,
            "source": f"{actor_id}/idle",
            "sourceMode": "frame-sequence",
        }},
    }

data = {
    "version": 2,
    "actors": {
        "alpha": actor("alpha", "Shared"),
        "beta": actor("beta", "shared"),
    },
}
source_contract = temp / "contract/assets/Data/vertical-slice-animation-sources.json"
source_contract.parent.mkdir(parents=True)
source_contract.write_text(json.dumps(data), encoding="utf-8")
try:
    builder.check_source_manifest(temp / "contract")
except ValueError as error:
    message = str(error)
    assert "alpha" in message and "beta" in message, message
    assert "Shared" in message and "shared" in message, message
else:
    raise AssertionError("case-insensitive folder collision must fail source validation")

runtime = temp / "runtime"
runtime_png = runtime / "Assets/ActorAtlases/Shared/idle.png"
source_manifest = temp / "assets/Data/animation-atlas.json"
resource_manifest = temp / "assets/resources/Data/animation-atlas.json"
candidate_sentinel = temp / "candidates/alpha/reports/alpha-report.json"
for path, payload in (
    (runtime_png, b"runtime-sentinel"),
    (source_manifest, b'{"version":2,"framePacking":"vertical-slice-action-atlases","actors":[]}\n'),
    (resource_manifest, b'{"version":2,"framePacking":"vertical-slice-action-atlases","actors":[]}\n'),
    (candidate_sentinel, b"candidate-sentinel"),
):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
watched = [runtime_png, source_manifest, resource_manifest, candidate_sentinel]
before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
try:
    builder.promote_selected_actors(
        data, ["alpha"], temp / "missing-source", temp / "candidates",
        runtime, source_manifest, resource_manifest,
    )
except ValueError as error:
    message = str(error)
    assert "alpha" in message and "beta" in message, message
else:
    raise AssertionError("selection pipeline must reject global folder collisions")
after = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
assert after == before
print("folder collision contained")
`
    assert.match(runPython(script, [tempRoot]), /folder collision contained/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('promotion consumes a hashed reviewed candidate without rebuilding source frames', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-verified-candidate-'))
  try {
    const script = String.raw`
import copy
import hashlib
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

def write_frame(color):
    path = temp / "source/alpha/idle/00.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((38, 24, 89, 139), fill=color)
    image.save(path)

actor = {
    "id": "alpha", "folder": "Alpha", "type": "monster",
    "masterFrameSize": [128, 160], "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85}, "quality": builder.DEFAULT_QUALITY,
    "actions": {"idle": {
        "frames": 1, "fps": 6, "loop": True,
        "source": "alpha/idle", "sourceMode": "frame-sequence",
        "events": [{"name": "ready", "time": 0.5}],
    }},
}
data = {"version": 2, "sourceRoot": "source", "actors": {"alpha": actor}}
candidate_root = temp / "candidates"
runtime = temp / "runtime"
source_manifest = temp / "assets/Data/animation-atlas.json"
resource_manifest = temp / "assets/resources/Data/animation-atlas.json"
manifest = {
    "version": 2, "framePacking": "vertical-slice-action-atlases",
    "actors": [{"id": "legacy", "type": "monster", "atlas": "Assets/ActorAtlases/Legacy/idle.png", "frameSize": {"w": 1, "h": 1}, "actions": []}],
}
payload = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
for path in (source_manifest, resource_manifest):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)

write_frame((50, 120, 220, 255))
builder.build_candidate_actors(data, ["alpha"], temp / "source", candidate_root)
package_path = candidate_root / "alpha/candidate-package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
candidate_png = candidate_root / "alpha/Assets/ActorAtlases/Alpha/idle.png"
candidate_bytes = candidate_png.read_bytes()
assert package["actorId"] == "alpha"
assert package["folder"] == "Alpha"
assert package["status"] == "candidate"
assert package["report"]["path"] == "reports/alpha-report.json"
assert package["report"]["status"] == "candidate"
assert package["actor"]["id"] == "alpha"
assert package["sourceManifestFingerprint"]
assert package["actorConfigFingerprint"]
listed = {entry["path"]: entry["sha256"] for entry in package["files"]}
assert listed["Assets/ActorAtlases/Alpha/idle.png"] == hashlib.sha256(candidate_bytes).hexdigest()
assert listed["reports/alpha-report.json"] == hashlib.sha256((candidate_root / "alpha/reports/alpha-report.json").read_bytes()).hexdigest()

write_frame((230, 60, 50, 255))
builder.promote_selected_actors(
    data, ["alpha"], temp / "source", candidate_root,
    runtime, source_manifest, resource_manifest,
)
runtime_png = runtime / "Assets/ActorAtlases/Alpha/idle.png"
assert runtime_png.read_bytes() == candidate_bytes, "promote rebuilt changed source instead of consuming candidate"
approved_package = json.loads(package_path.read_text(encoding="utf-8"))
approved_report = json.loads((candidate_root / "alpha/reports/alpha-report.json").read_text(encoding="utf-8"))
assert approved_package["status"] == "approved"
assert approved_package["report"]["status"] == "approved"
assert approved_report["status"] == "approved"

write_frame((50, 120, 220, 255))
builder.build_candidate_actors(data, ["alpha"], temp / "source", candidate_root)
candidate_png.write_bytes(candidate_png.read_bytes() + b"tampered")
watched = [runtime_png, source_manifest, resource_manifest]
before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
try:
    builder.promote_selected_actors(data, ["alpha"], temp / "source", candidate_root, runtime, source_manifest, resource_manifest)
except ValueError as error:
    assert "hash" in str(error).lower(), error
else:
    raise AssertionError("tampered candidate must be rejected")
assert before == {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}

builder.build_candidate_actors(data, ["alpha"], temp / "source", candidate_root)
changed = copy.deepcopy(data)
changed["actors"]["alpha"]["actions"]["idle"]["fps"] = 7
try:
    builder.promote_selected_actors(changed, ["alpha"], temp / "source", candidate_root, runtime, source_manifest, resource_manifest)
except ValueError as error:
    assert "fingerprint" in str(error).lower(), error
else:
    raise AssertionError("stale candidate config must be rejected")
assert before == {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in watched}
print("verified candidate consumed")
`
    assert.match(runPython(script, [tempRoot]), /verified candidate consumed/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('journaled promotion rolls back every injected failure and recovers interrupted commits', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-journal-recovery-'))
  try {
    const script = String.raw`
import hashlib
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

actor = {
    "id": "alpha", "folder": "Alpha", "type": "monster",
    "masterFrameSize": [128, 160], "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85}, "quality": builder.DEFAULT_QUALITY,
    "actions": {"idle": {
        "frames": 1, "fps": 6, "loop": True,
        "source": "alpha/idle", "sourceMode": "frame-sequence",
    }},
}
data = {"version": 2, "actors": {"alpha": actor}}

def tree_hash(path):
    path = Path(path)
    if not path.exists():
        return None
    if path.is_file():
        return hashlib.sha256(path.read_bytes()).hexdigest()
    digest = hashlib.sha256()
    for item in sorted(path.rglob("*"), key=lambda value: value.as_posix()):
        if item.is_file():
            digest.update(item.relative_to(path).as_posix().encode())
            digest.update(item.read_bytes())
    return digest.hexdigest()

def setup(case):
    source_frame = case / "source/alpha/idle/00.png"
    source_frame.parent.mkdir(parents=True)
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((38, 24, 89, 139), fill=(60, 130, 220, 255))
    image.save(source_frame)
    candidate_root = case / "candidates"
    builder.build_candidate_actors(data, ["alpha"], case / "source", candidate_root)
    runtime = case / "runtime"
    runtime_png = runtime / "Assets/ActorAtlases/Alpha/idle.png"
    runtime_png.parent.mkdir(parents=True)
    runtime_png.write_bytes(b"old-runtime")
    source_manifest = case / "assets/Data/animation-atlas.json"
    resource_manifest = case / "assets/resources/Data/animation-atlas.json"
    manifest = {
        "version": 2, "framePacking": "vertical-slice-action-atlases",
        "actors": [{
            "id": "alpha", "type": "monster",
            "atlas": "Assets/ActorAtlases/Alpha/idle.png",
            "frameSize": {"w": 1, "h": 1}, "actions": [],
        }],
    }
    payload = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    for path in (source_manifest, resource_manifest):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    watched = [runtime / "Assets/ActorAtlases/Alpha", candidate_root / "alpha", source_manifest, resource_manifest]
    return runtime, candidate_root, source_manifest, resource_manifest, watched

for failure_index in range(1, 5):
    case = temp / f"failure-{failure_index}"
    runtime, candidates, source_manifest, resource_manifest, watched = setup(case)
    before = [tree_hash(path) for path in watched]
    try:
        builder.promote_selected_actors(
            data, ["alpha"], case / "source", candidates, runtime,
            source_manifest, resource_manifest,
            fault_after_replacement=failure_index,
        )
    except RuntimeError as error:
        assert "injected" in str(error).lower(), error
    else:
        raise AssertionError(f"fault {failure_index} did not interrupt promotion")
    assert [tree_hash(path) for path in watched] == before, failure_index
    assert not builder._promotion_journal_path(runtime).exists(), failure_index

case = temp / "interrupted"
runtime, candidates, source_manifest, resource_manifest, watched = setup(case)
before = [tree_hash(path) for path in watched]
try:
    builder.promote_selected_actors(
        data, ["alpha"], case / "source", candidates, runtime,
        source_manifest, resource_manifest,
        fault_after_replacement=2,
        simulate_interruption=True,
    )
except BaseException as error:
    assert "interrupted" in str(error).lower(), error
else:
    raise AssertionError("simulated process interruption did not occur")
journal = builder._promotion_journal_path(runtime)
assert journal.exists()
builder.recover_incomplete_promotion(
    runtime,
    candidate_root=candidates,
    source_manifest_path=source_manifest,
    resource_manifest_path=resource_manifest,
    selected_actor_folders={"alpha": "Alpha"},
)
assert [tree_hash(path) for path in watched] == before
assert not journal.exists()
print("journal recovery complete")
`
    assert.match(runPython(script, [tempRoot]), /journal recovery complete/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('normal promotion requires identical authoritative runtime manifests', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-dual-manifest-'))
  try {
    const script = String.raw`
import hashlib
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

actor = {
    "id": "alpha", "folder": "Alpha", "type": "monster",
    "masterFrameSize": [128, 160], "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85}, "quality": builder.DEFAULT_QUALITY,
    "actions": {"idle": {"frames": 1, "fps": 6, "loop": True, "source": "alpha/idle", "sourceMode": "frame-sequence"}},
}
data = {"version": 2, "actors": {"alpha": actor}}

def valid_manifest(actors=None):
    return {
        "version": 2, "framePacking": "vertical-slice-action-atlases",
        "actors": actors if actors is not None else [{
            "id": "legacy", "type": "monster", "atlas": "Assets/ActorAtlases/Legacy/idle.png",
            "frameSize": {"w": 1, "h": 1}, "actions": [],
        }],
    }

def digest_tree(path):
    path = Path(path)
    digest = hashlib.sha256()
    if not path.exists():
        return "missing"
    for item in sorted(path.rglob("*"), key=lambda value: value.as_posix()):
        if item.is_file():
            digest.update(item.relative_to(path).as_posix().encode())
            digest.update(item.read_bytes())
    return digest.hexdigest()

def setup(case):
    frame = case / "source/alpha/idle/00.png"
    frame.parent.mkdir(parents=True)
    image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((38, 24, 89, 139), fill=(60, 130, 220, 255))
    image.save(frame)
    candidates = case / "candidates"
    builder.build_candidate_actors(data, ["alpha"], case / "source", candidates)
    runtime = case / "runtime"
    sentinel = runtime / "Assets/ActorAtlases/Legacy/idle.png"
    sentinel.parent.mkdir(parents=True)
    sentinel.write_bytes(b"legacy-runtime")
    source_manifest = case / "assets/Data/animation-atlas.json"
    resource_manifest = case / "assets/resources/Data/animation-atlas.json"
    return candidates, runtime, source_manifest, resource_manifest

cases = ("missing", "divergent", "duplicate", "schema")
for name in cases:
    case = temp / name
    candidates, runtime, source_manifest, resource_manifest = setup(case)
    source_manifest.parent.mkdir(parents=True)
    resource_manifest.parent.mkdir(parents=True)
    source_data = valid_manifest()
    resource_data = valid_manifest()
    if name == "missing":
        source_manifest.write_text(json.dumps(source_data), encoding="utf-8")
    elif name == "divergent":
        source_manifest.write_text(json.dumps(source_data), encoding="utf-8")
        resource_data["actors"][0]["type"] = "character"
        resource_manifest.write_text(json.dumps(resource_data), encoding="utf-8")
    elif name == "duplicate":
        duplicate = source_data["actors"][0].copy()
        source_data["actors"].append(duplicate)
        payload = json.dumps(source_data)
        source_manifest.write_text(payload, encoding="utf-8")
        resource_manifest.write_text(payload, encoding="utf-8")
    else:
        source_data["framePacking"] = "wrong"
        payload = json.dumps(source_data)
        source_manifest.write_text(payload, encoding="utf-8")
        resource_manifest.write_text(payload, encoding="utf-8")
    before = digest_tree(case)
    try:
        builder.promote_selected_actors(data, ["alpha"], case / "source", candidates, runtime, source_manifest, resource_manifest)
    except (FileNotFoundError, ValueError) as error:
        assert name in ("missing", "divergent", "duplicate", "schema")
    else:
        raise AssertionError(f"invalid dual manifest case accepted: {name}")
    assert digest_tree(case) == before, name
print("dual manifest authority enforced")
`
    assert.match(runPython(script, [tempRoot]), /dual manifest authority enforced/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('runtime ownership reparse checks and target-local staging protect actor folders', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-runtime-ownership-'))
  try {
    const script = String.raw`
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class WindowsReparseStat:
    st_file_attributes = 0x400
assert builder._stat_has_windows_reparse(WindowsReparseStat())

target = temp / "runtime-volume/Assets/ActorAtlases/Alpha"
staged = builder._staging_path_for_target(target, "unit")
assert staged.parent == target.parent
assert staged.name.startswith(".Alpha.promotion-stage-")

copy_source = temp / "candidate-volume/source.txt"
copy_source.parent.mkdir(parents=True)
copy_source.write_bytes(b"candidate")
entry = builder._stage_replacement(copy_source, target.parent / "file.txt", "local")
assert builder._path_key(Path(entry["staged"]).parent) == builder._path_key(target.parent)
builder._remove_path(Path(entry["staged"]))

original_volume_id = builder._volume_id
try:
    builder._volume_id = lambda path: 1 if "source-volume" in str(path) else 2
    try:
        builder._assert_same_replace_volume(temp / "source-volume/file", temp / "target-volume/file")
    except ValueError as error:
        assert "volume" in str(error).lower(), error
    else:
        raise AssertionError("cross-volume replace validation did not fail")
finally:
    builder._volume_id = original_volume_id

actor = {
    "id": "alpha", "folder": "Shared", "type": "monster",
    "masterFrameSize": [128, 160], "runtimeFrameSize": [64, 80],
    "anchor": {"x": 0.5, "y": 0.85}, "quality": builder.DEFAULT_QUALITY,
    "actions": {"idle": {"frames": 1, "fps": 6, "loop": True, "source": "alpha/idle", "sourceMode": "frame-sequence"}},
}
data = {"version": 2, "actors": {"alpha": actor}}
frame = temp / "ownership/source/alpha/idle/00.png"
frame.parent.mkdir(parents=True)
image = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
ImageDraw.Draw(image).rectangle((38, 24, 89, 139), fill=(60, 130, 220, 255))
image.save(frame)
candidates = temp / "ownership/candidates"
builder.build_candidate_actors(data, ["alpha"], temp / "ownership/source", candidates)
runtime = temp / "ownership/runtime"
runtime_png = runtime / "Assets/ActorAtlases/Shared/idle.png"
runtime_png.parent.mkdir(parents=True)
runtime_png.write_bytes(b"beta-owned")
source_manifest = temp / "ownership/assets/Data/animation-atlas.json"
resource_manifest = temp / "ownership/assets/resources/Data/animation-atlas.json"
manifest = {
    "version": 2, "framePacking": "vertical-slice-action-atlases",
    "actors": [{"id": "beta", "type": "monster", "atlas": "Assets/ActorAtlases/Shared/idle.png", "frameSize": {"w": 1, "h": 1}, "actions": []}],
}
payload = (json.dumps(manifest, indent=2) + "\n").encode()
for path in (source_manifest, resource_manifest):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
before = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (runtime_png, source_manifest, resource_manifest)]
try:
    builder.promote_selected_actors(data, ["alpha"], temp / "ownership/source", candidates, runtime, source_manifest, resource_manifest)
except ValueError as error:
    assert "beta" in str(error) and "alpha" in str(error), error
else:
    raise AssertionError("selected actor stole an unselected actor folder")
assert before == [hashlib.sha256(path.read_bytes()).hexdigest() for path in (runtime_png, source_manifest, resource_manifest)]

link_case = temp / "symlink"
outside = link_case / "outside"
outside.mkdir(parents=True)
link = link_case / "runtime/Assets/ActorAtlases/Alpha"
link.parent.mkdir(parents=True)
try:
    os.symlink(outside, link, target_is_directory=True)
except OSError:
    pass
else:
    try:
        builder._assert_safe_runtime_actor_target(link_case / "runtime", "Alpha")
    except ValueError as error:
        assert "reparse" in str(error).lower() or "link" in str(error).lower(), error
    else:
        raise AssertionError("runtime symlink target was accepted")
print("runtime folder boundaries enforced")
`
    assert.match(runPython(script, [tempRoot]), /runtime folder boundaries enforced/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('committed cleanup failures retry cleanup without rolling back installed targets', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-commit-cleanup-'))
  try {
    const script = String.raw`
import importlib.util
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

runtime = temp / "runtime"
sources = temp / "sources"
replacements = []
for name in ("Alpha", "Beta"):
    source = sources / name
    source.mkdir(parents=True)
    (source / "idle.png").write_bytes(f"new-{name}".encode())
    target = runtime / "Assets/ActorAtlases" / name
    target.mkdir(parents=True)
    (target / "idle.png").write_bytes(f"old-{name}".encode())
    replacements.append((source, target))

original_remove = builder._remove_path
failed = {"done": False}
def fail_one_backup_cleanup(path):
    path = Path(path)
    if path.exists() and "promotion-backup" in path.name and "Alpha" in path.name and not failed["done"]:
        failed["done"] = True
        raise OSError("injected mixed backup cleanup failure")
    return original_remove(path)

builder._remove_path = fail_one_backup_cleanup
try:
    try:
        builder._commit_journaled_replacements(
            replacements, runtime,
            candidate_root=None,
            source_manifest_path=None,
            resource_manifest_path=None,
            selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
        )
    except RuntimeError as error:
        assert "cleanup" in str(error).lower(), error
    else:
        raise AssertionError("cleanup failure was not surfaced")
finally:
    builder._remove_path = original_remove

for name in ("Alpha", "Beta"):
    assert (runtime / "Assets/ActorAtlases" / name / "idle.png").read_bytes() == f"new-{name}".encode()
journal_path = builder._promotion_journal_path(runtime)
journal = json.loads(journal_path.read_text(encoding="utf-8"))
assert journal["state"] == "cleanup-failed"
builder.recover_incomplete_promotion(
    runtime,
    candidate_root=None,
    source_manifest_path=None,
    resource_manifest_path=None,
    selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
)
assert not journal_path.exists()
for name in ("Alpha", "Beta"):
    assert (runtime / "Assets/ActorAtlases" / name / "idle.png").read_bytes() == f"new-{name}".encode()
print("committed cleanup converged")
`
    assert.match(runPython(script, [tempRoot]), /committed cleanup converged/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('rollback progress converges after a transient entry failure', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-rollback-progress-'))
  try {
    const script = String.raw`
import importlib.util
import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

runtime = temp / "runtime"
replacements = []
for name in ("Alpha", "Beta"):
    source = temp / "sources" / name
    source.mkdir(parents=True)
    (source / "idle.png").write_bytes(f"new-{name}".encode())
    target = runtime / "Assets/ActorAtlases" / name
    target.mkdir(parents=True)
    (target / "idle.png").write_bytes(f"old-{name}".encode())
    replacements.append((source, target))

try:
    builder._commit_journaled_replacements(
        replacements, runtime,
        candidate_root=None,
        source_manifest_path=None,
        resource_manifest_path=None,
        selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
        fault_after_replacement=2,
        simulate_interruption=True,
    )
except BaseException:
    pass
else:
    raise AssertionError("interrupted transaction was not left for recovery")

original_copytree = builder.shutil.copytree
failed = {"done": False}
def fail_one_restore(source, target, *args, **kwargs):
    if "promotion-backup" in Path(source).name and "Alpha" in Path(source).name and not failed["done"]:
        failed["done"] = True
        raise OSError("transient restore failure")
    return original_copytree(source, target, *args, **kwargs)
builder.shutil.copytree = fail_one_restore
try:
    try:
        builder.recover_incomplete_promotion(
            runtime,
            candidate_root=None,
            source_manifest_path=None,
            resource_manifest_path=None,
            selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
        )
    except RuntimeError as error:
        assert "transient restore failure" in str(error), error
    else:
        raise AssertionError("transient rollback failure was not surfaced")
finally:
    builder.shutil.copytree = original_copytree

journal_path = builder._promotion_journal_path(runtime)
journal = json.loads(journal_path.read_text(encoding="utf-8"))
assert journal["state"] == "recovery-failed"
assert any(entry["state"] == "rolled-back" for entry in journal["entries"])
builder.recover_incomplete_promotion(
    runtime,
    candidate_root=None,
    source_manifest_path=None,
    resource_manifest_path=None,
    selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
)
assert not journal_path.exists()
for name in ("Alpha", "Beta"):
    assert (runtime / "Assets/ActorAtlases" / name / "idle.png").read_bytes() == f"old-{name}".encode()
print("rollback progress converged")
`
    assert.match(runPython(script, [tempRoot]), /rollback progress converged/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('journal validation rejects external paths before touching them', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-journal-trust-'))
  try {
    const script = String.raw`
import copy
import importlib.util
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

runtime = temp / "project/runtime"
source = temp / "project/source/Alpha"
source.mkdir(parents=True)
(source / "idle.png").write_bytes(b"new")
target = runtime / "Assets/ActorAtlases/Alpha"
target.mkdir(parents=True)
(target / "idle.png").write_bytes(b"old")
try:
    builder._commit_journaled_replacements(
        [(source, target)], runtime,
        candidate_root=None,
        source_manifest_path=None,
        resource_manifest_path=None,
        selected_actor_folders={"alpha": "Alpha"},
        fault_after_replacement=1,
        simulate_interruption=True,
    )
except BaseException:
    pass
journal_path = builder._promotion_journal_path(runtime)
valid = json.loads(journal_path.read_text(encoding="utf-8"))
assert valid["version"] >= 2
assert valid["token"]
assert valid["allowedTargets"] == [valid["entries"][0]["target"]]

outside = temp / "outside-sentinel.txt"
outside.write_bytes(b"do-not-touch")
outside_stage = temp / "outside-stage.txt"
outside_stage.write_bytes(b"stage-do-not-touch")
outside_backup = temp / "outside-backup.txt"
outside_backup.write_bytes(b"backup-do-not-touch")
baseline = (outside.read_bytes(), outside_stage.read_bytes(), outside_backup.read_bytes())

tamperers = [
    lambda data: data.update(version=999),
    lambda data: data.update(runtimeRoot=str(temp / "wrong-runtime")),
    lambda data: data.update(token="../bad"),
    lambda data: data["entries"][0].update(target=str(outside)),
    lambda data: data["entries"][0].update(staged=str(outside_stage)),
    lambda data: data["entries"][0].update(backup=str(outside_backup)),
]
for tamper in tamperers:
    data = copy.deepcopy(valid)
    tamper(data)
    journal_path.write_text(json.dumps(data), encoding="utf-8")
    try:
        builder.recover_incomplete_promotion(
            runtime,
            candidate_root=None,
            source_manifest_path=None,
            resource_manifest_path=None,
            selected_actor_folders={"alpha": "Alpha"},
        )
    except (RuntimeError, ValueError):
        pass
    else:
        raise AssertionError("tampered journal was accepted")
    assert (outside.read_bytes(), outside_stage.read_bytes(), outside_backup.read_bytes()) == baseline
    assert target.exists()

journal_path.write_text(json.dumps(valid), encoding="utf-8")
builder.recover_incomplete_promotion(
    runtime,
    candidate_root=None,
    source_manifest_path=None,
    resource_manifest_path=None,
    selected_actor_folders={"alpha": "Alpha"},
)
assert (target / "idle.png").read_bytes() == b"old"
print("journal trust boundary enforced")
`
    assert.match(runPython(script, [tempRoot]), /journal trust boundary enforced/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('copy and initial journal write failures remove every partial staging path', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-staging-cleanup-'))
  try {
    const script = String.raw`
import importlib.util
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

runtime = temp / "runtime"
source = temp / "source.txt"
source.write_bytes(b"new")
target = runtime / "Assets/ActorAtlases/Alpha/file.txt"
target.parent.mkdir(parents=True)
target.write_bytes(b"old")
token = "copyfail"
staged = builder._staging_path_for_target(target, token)
backup = builder._backup_path_for_target(target, token)
original_copy2 = builder.shutil.copy2
def partial_copy_then_fail(source_path, staged_path):
    Path(staged_path).write_bytes(b"partial")
    raise OSError("injected copy failure")
builder.shutil.copy2 = partial_copy_then_fail
try:
    try:
        builder._stage_replacement(source, target, token)
    except OSError as error:
        assert "copy failure" in str(error), error
    else:
        raise AssertionError("copy failure was not surfaced")
finally:
    builder.shutil.copy2 = original_copy2
assert not staged.exists() and not backup.exists()
assert target.read_bytes() == b"old"

replacements = []
for name in ("Alpha", "Beta"):
    replacement = temp / "sources" / name
    replacement.mkdir(parents=True)
    (replacement / "idle.png").write_bytes(f"new-{name}".encode())
    actor_target = runtime / "Assets/ActorAtlases" / name
    actor_target.mkdir(parents=True, exist_ok=True)
    (actor_target / "idle.png").write_bytes(f"old-{name}".encode())
    replacements.append((replacement, actor_target))

original_write = builder._write_journal
def fail_initial_journal(path, journal):
    raise OSError("injected initial journal write failure")
builder._write_journal = fail_initial_journal
try:
    try:
        builder._commit_journaled_replacements(
            replacements, runtime,
            candidate_root=None,
            source_manifest_path=None,
            resource_manifest_path=None,
            selected_actor_folders={"alpha": "Alpha", "beta": "Beta"},
        )
    except OSError as error:
        assert "journal write failure" in str(error), error
    else:
        raise AssertionError("initial journal write failure was not surfaced")
finally:
    builder._write_journal = original_write

assert not builder._promotion_journal_path(runtime).exists()
assert not list((runtime / "Assets/ActorAtlases").glob(".*.promotion-stage-*"))
assert not list((runtime / "Assets/ActorAtlases").glob(".*.promotion-backup-*"))
for name in ("Alpha", "Beta"):
    assert (runtime / "Assets/ActorAtlases" / name / "idle.png").read_bytes() == f"old-{name}".encode()
print("staging failures cleaned")
`
    assert.match(runPython(script, [tempRoot]), /staging failures cleaned/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('recovery anchors candidate and allowed targets to trusted caller roots', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'vertical-slice-trusted-recovery-'))
  try {
    const script = String.raw`
import copy
import importlib.util
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
temp = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

runtime = temp / "runtime"
candidate_root = temp / "candidates"
source_manifest = temp / "assets/Data/animation-atlas.json"
resource_manifest = temp / "assets/resources/Data/animation-atlas.json"
runtime_source = temp / "sources/runtime-alpha"
candidate_source = temp / "sources/candidate-alpha"
manifest_source = temp / "sources/source.json"
resource_source = temp / "sources/resource.json"
for directory, payload in ((runtime_source, b"new-runtime"), (candidate_source, b"new-candidate")):
    directory.mkdir(parents=True)
    (directory / "idle.png").write_bytes(payload)
manifest_source.parent.mkdir(parents=True, exist_ok=True)
manifest_source.write_bytes(b"new-source-manifest")
resource_source.write_bytes(b"new-resource-manifest")

runtime_target = runtime / "Assets/ActorAtlases/Alpha"
candidate_target = candidate_root / "alpha"
for directory, payload in ((runtime_target, b"old-runtime"), (candidate_target, b"old-candidate")):
    directory.mkdir(parents=True)
    (directory / "idle.png").write_bytes(payload)
for path, payload in ((source_manifest, b"old-source-manifest"), (resource_manifest, b"old-resource-manifest")):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)

replacements = [
    (runtime_source, runtime_target),
    (candidate_source, candidate_target),
    (manifest_source, source_manifest),
    (resource_source, resource_manifest),
]
try:
    builder._commit_journaled_replacements(
        replacements,
        runtime,
        candidate_root=candidate_root,
        source_manifest_path=source_manifest,
        resource_manifest_path=resource_manifest,
        selected_actor_folders={"alpha": "Alpha"},
        fault_after_replacement=1,
        simulate_interruption=True,
    )
except BaseException:
    pass
else:
    raise AssertionError("trusted-root transaction was not interrupted")

journal_path = builder._promotion_journal_path(runtime)
valid = json.loads(journal_path.read_text(encoding="utf-8"))
victim_root = temp / "victim"
victim = victim_root / "alpha"
victim.mkdir(parents=True)
(victim / "secret.txt").write_bytes(b"never-touch")
tampered = copy.deepcopy(valid)
tampered["candidateRoot"] = str(victim_root)
candidate_entry = next(entry for entry in tampered["entries"] if Path(entry["target"]).parent == candidate_root)
old_target = candidate_entry["target"]
candidate_entry["target"] = str(victim)
candidate_entry["staged"] = str(builder._staging_path_for_target(victim, tampered["token"]))
candidate_entry["backup"] = str(builder._backup_path_for_target(victim, tampered["token"]))
tampered["allowedTargets"] = [str(victim) if value == old_target else value for value in tampered["allowedTargets"]]
journal_path.write_text(json.dumps(tampered), encoding="utf-8")

try:
    builder.recover_incomplete_promotion(
        runtime,
        candidate_root=candidate_root,
        source_manifest_path=source_manifest,
        resource_manifest_path=resource_manifest,
        selected_actor_folders={"alpha": "Alpha"},
    )
except (RuntimeError, ValueError):
    pass
else:
    raise AssertionError("journal-provided candidate root was trusted")
assert (victim / "secret.txt").read_bytes() == b"never-touch"
assert not builder._staging_path_for_target(victim, tampered["token"]).exists()
assert not builder._backup_path_for_target(victim, tampered["token"]).exists()

journal_path.write_text(json.dumps(valid), encoding="utf-8")
builder.recover_incomplete_promotion(
    runtime,
    candidate_root=candidate_root,
    source_manifest_path=source_manifest,
    resource_manifest_path=resource_manifest,
    selected_actor_folders={"alpha": "Alpha"},
)
assert (runtime_target / "idle.png").read_bytes() == b"old-runtime"
assert (candidate_target / "idle.png").read_bytes() == b"old-candidate"
assert source_manifest.read_bytes() == b"old-source-manifest"
assert resource_manifest.read_bytes() == b"old-resource-manifest"
print("trusted recovery roots enforced")
`
    assert.match(runPython(script, [tempRoot]), /trusted recovery roots enforced/)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
