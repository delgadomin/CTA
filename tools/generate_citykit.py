"""Generate the original, procedural Cáceres city kit as GLB files.

Run with Blender 5.x in background mode:

    blender.exe --background --python tools/generate_citykit.py

Everything here is authored from scratch. No downloads, no third-party meshes,
no textures and no external licences are involved. The kit is intentionally
small and uses flat PBR materials so the browser can load it without KTX2.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models" / "citykit"

MATERIALS: dict[str, bpy.types.Material] = {}


def material(name: str, rgb: tuple[float, float, float], roughness: float = 0.8,
             metallic: float = 0.0) -> bpy.types.Material:
    if name in MATERIALS:
        return MATERIALS[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = (*rgb, 1.0)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    MATERIALS[name] = mat
    return mat


IRON = material("kit_iron", (0.16, 0.18, 0.17), 0.52, 0.55)
PAINTED_STEEL = material("kit_painted_steel", (0.28, 0.32, 0.29), 0.62, 0.3)
GLASS = material("kit_lamp_glass", (1.0, 0.89, 0.62), 0.32, 0.0)
BARK = material("kit_bark", (0.29, 0.21, 0.14), 0.95)
LEAVES = material("kit_leaves", (0.23, 0.39, 0.18), 0.82)
LEAVES_LIGHT = material("kit_leaves_light", (0.31, 0.47, 0.21), 0.84)
SIGN_RED = material("kit_sign_red", (0.67, 0.16, 0.13), 0.7)
SIGN_WHITE = material("kit_sign_white", (0.92, 0.91, 0.84), 0.75)
SIGN_YELLOW = material("kit_sign_yellow", (0.85, 0.66, 0.17), 0.72)
BRICK = material("kit_brick", (0.52, 0.28, 0.19), 0.92)
STONE = material("kit_stone", (0.7, 0.66, 0.56), 0.88)
RAILING = material("kit_railing", (0.2, 0.22, 0.2), 0.55, 0.45)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for item in list(bpy.data.meshes):
        if item.users == 0:
            bpy.data.meshes.remove(item)


def set_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    obj.data.materials.append(mat)


def box(name: str, center: tuple[float, float, float], size: tuple[float, float, float],
        mat: bpy.types.Material, rotate_z: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.rotation_euler[2] = rotate_z
    set_material(obj, mat)
    return obj


def cylinder(name: str, center: tuple[float, float, float], radius: float, depth: float,
             mat: bpy.types.Material, vertices: int = 8) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=center)
    obj = bpy.context.object
    obj.name = name
    set_material(obj, mat)
    return obj


def cone(name: str, center: tuple[float, float, float], radius: float, depth: float,
         mat: bpy.types.Material, vertices: int = 8) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.0,
                                    depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    set_material(obj, mat)
    return obj


def ico(name: str, center: tuple[float, float, float], radius: float,
        mat: bpy.types.Material, subdivisions: int) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius,
                                          location=center)
    obj = bpy.context.object
    obj.name = name
    set_material(obj, mat)
    return obj


def export(name: str, manifest: dict[str, dict[str, object]]) -> None:
    bpy.ops.object.select_all(action="SELECT")
    triangles = sum(
        1 if len(poly.vertices) == 3 else len(poly.vertices) - 2
        for obj in bpy.context.selected_objects if obj.type == "MESH"
        for poly in obj.data.polygons
    )
    path = OUT_DIR / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    manifest[name] = {
        "path": f"models/citykit/{name}.glb",
        "triangles": triangles,
        "bytes": path.stat().st_size,
    }
    print(f"[citykit] {name}: {triangles} tris, {path.stat().st_size} bytes")


def street_lamp(lod: int) -> None:
    sides = 10 if lod == 0 else 6
    cylinder("base", (0, 0, 0.18), 0.22, 0.36, IRON, sides)
    cylinder("post", (0, 0, 1.95), 0.055, 3.2, PAINTED_STEEL, sides)
    cylinder("collar", (0, 0, 3.62), 0.11, 0.12, IRON, sides)
    lantern_sides = 4 if lod == 0 else 3
    cylinder("lantern", (0, 0, 3.92), 0.2, 0.46, GLASS, lantern_sides)
    cone("cap", (0, 0, 4.24), 0.25, 0.22, IRON, lantern_sides)


def tree(lod: int) -> None:
    sides = 8 if lod == 0 else 5
    cylinder("trunk", (0, 0, 0.95), 0.16, 1.9, BARK, sides)
    cylinder("branch_east", (0.24, 0, 1.9), 0.06, 0.85, BARK, sides // 2).rotation_euler[1] = 0.7
    cylinder("branch_west", (-0.22, 0.05, 1.85), 0.06, 0.8, BARK, sides // 2).rotation_euler[1] = -0.7
    detail = 2 if lod == 0 else 1
    ico("canopy_core", (0, 0, 2.85), 1.08, LEAVES, detail)
    ico("canopy_side", (0.5, 0.1, 2.55), 0.72, LEAVES_LIGHT, detail)
    ico("canopy_back", (-0.45, -0.2, 2.62), 0.68, LEAVES, detail)
    if lod == 0:
        ico("canopy_top", (0.05, 0.05, 3.5), 0.6, LEAVES_LIGHT, detail)


def sign_post(kind: str, lod: int) -> None:
    sides = 8 if lod == 0 else 5
    cylinder("post", (0, 0, 1.05), 0.045, 2.1, PAINTED_STEEL, sides)
    if kind == "traffic_signals":
        box("signal_box", (0, 0, 2.35), (0.24, 0.18, 0.75), IRON)
        for index, colour in enumerate((SIGN_RED, SIGN_YELLOW, LEAVES)):
            cylinder(f"lamp_{index}", (0, -0.1, 2.58 - index * 0.23), 0.055, 0.04,
                     colour, 8 if lod == 0 else 6).rotation_euler[0] = math.pi / 2
        return
    face = SIGN_RED if kind == "stop" else SIGN_WHITE
    border = SIGN_WHITE if kind == "stop" else SIGN_RED
    if kind == "stop":
        cylinder("sign_face", (0, -0.04, 1.92), 0.36, 0.05, face, 8 if lod == 0 else 6).rotation_euler[0] = math.pi / 2
        cylinder("sign_border", (0, -0.07, 1.92), 0.4, 0.02, border, 8 if lod == 0 else 6).rotation_euler[0] = math.pi / 2
    else:
        box("sign_face", (0, -0.05, 1.85), (0.72, 0.03, 0.72), face, math.pi / 4)
        box("sign_border", (0, -0.07, 1.85), (0.82, 0.02, 0.82), border, math.pi / 4)


def chimney(lod: int) -> None:
    sides = 8 if lod == 0 else 4
    box("shaft", (0, 0, 0.55), (0.46, 0.46, 1.1), BRICK)
    box("cap", (0, 0, 1.16), (0.62, 0.62, 0.12), STONE)
    if lod == 0:
        cylinder("flue", (0, 0, 1.28), 0.13, 0.18, IRON, sides)


def balcony(lod: int) -> None:
    # Blender +Y becomes glTF -Z, so the railing sits at -Y to face glTF +Z.
    box("slab", (0, 0, 0.04), (1.3, 0.42, 0.08), STONE)
    box("rail_top", (0, -0.19, 0.62), (1.3, 0.05, 0.05), RAILING)
    bars = 5 if lod == 0 else 3
    for index in range(bars):
        x = -0.56 + (1.12 * index) / (bars - 1)
        box(f"bar_{index}", (x, -0.19, 0.34), (0.035, 0.035, 0.56), RAILING)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, object]] = {}
    builders = {
        "street-lamp": street_lamp,
        "tree": tree,
        "traffic-signals": lambda lod: sign_post("traffic_signals", lod),
        "stop-sign": lambda lod: sign_post("stop", lod),
        "give-way-sign": lambda lod: sign_post("give_way", lod),
        "chimney": chimney,
        "balcony": balcony,
    }
    for name, build in builders.items():
        for lod in (0, 1):
            clear_scene()
            build(lod)
            export(f"{name}-lod{lod}", manifest)
    payload = {
        "schemaVersion": 1,
        "generator": "tools/generate_citykit.py",
        "licence": "CC0-1.0 (original procedural geometry)",
        "models": manifest,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"[citykit] wrote {len(manifest)} GLB files to {OUT_DIR}")


if __name__ == "__main__":
    main()
