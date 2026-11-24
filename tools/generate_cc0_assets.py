"""Build the CC0 character and car GLBs used by Cáceres Criminal.

Run with Blender 5.2 after downloading the Kenney CC0 packs:

    blender.exe --background --factory-startup --python tools/generate_cc0_assets.py -- \
      --characters <path-to-animated-characters-protagonists> \
      --cars <path-to-car-kit> \
      --output <repository-root>

The source packs are not committed: only the generated GLBs are served at runtime.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


BLENDER_ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--characters", type=Path, required=True)
    parser.add_argument("--cars", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(BLENDER_ARGS)


def copy_action(armature: bpy.types.Object, path: Path, needle: str, name: str) -> bpy.types.Action:
    """Import one Kenney animation FBX and retarget its action to the source rig."""
    before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj.type == "ARMATURE" and obj != armature]
    action = next(
        (candidate for candidate in set(bpy.data.actions) - before if needle.lower() in candidate.name.lower()),
        None,
    )
    if action is None:
        raise RuntimeError(f"Missing {needle} action in {path}")
    for duplicate in imported:
        bpy.data.objects.remove(duplicate, do_unlink=True)
    copied = action.copy()
    copied.name = name
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = copied
    armature.animation_data.action_slot = copied.slots[0]
    return copied


def build_character(source: Path, output: Path) -> None:
    """Export the Kenney rig at player height with exactly two named clips."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source / "Model" / "characterMedium.fbx"))
    armature = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    armature.name = "CharacterRig"
    # The FBX is 3.765 units tall; 0.5 gives the 1.88 m player silhouette.
    armature.scale = (0.5, 0.5, 0.5)

    idle = copy_action(armature, source / "Animations" / "idle.fbx", "idle", "idle")
    # Kenney ships run instead of walk; the slower runtime clip uses the same cycle.
    walk = copy_action(armature, source / "Animations" / "run.fbx", "run", "walk")
    for action in list(bpy.data.actions):
        if action not in (idle, walk):
            bpy.data.actions.remove(action)

    material = bpy.data.materials.get("skin")
    if material is None:
        raise RuntimeError("The Kenney character mesh has no skin material.")
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF") or next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(
        str(source / "Skins" / "skaterMaleA.png"), check_existing=True
    )
    material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])

    armature.animation_data.action = idle
    armature.animation_data.action_slot = idle.slots[0]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_yup=True,
        export_image_format="AUTO",
        export_keep_originals=False,
    )


def build_car(source: Path, output: Path) -> None:
    """Re-export the Kenney sedan with its colour map embedded in the GLB."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source / "Models" / "GLB format" / "sedan.glb"))
    for image in bpy.data.images:
        if image.source == "FILE" and image.packed_file is None:
            image.pack()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_yup=True,
        export_image_format="AUTO",
        export_keep_originals=False,
    )


def main() -> None:
    args = parse_args()
    build_character(args.characters, args.output / "public/models/characters/caceres-pedestrian.glb")
    build_car(args.cars, args.output / "public/models/vehicles/caceres-sedan.glb")
    print("Generated CC0 GLBs in", args.output / "public/models")


if __name__ == "__main__":
    main()
