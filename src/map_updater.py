import requests
import os
from PIL import Image
from math import floor

def fetch_and_merge_tiles_from_mc_coords(
    base_url,
    world,
    mc_x1,
    mc_z1,
    mc_x2,
    mc_z2
):
    """
    Télécharge et assemble dynmap à partir de coordonnées Minecraft (x,z)
    """
    tile_size = 32  # chaque tuile couvre 32x32 blocs Minecraft
    tiles_dir = "../public/assets/map/tiles_temp"
    output_file="../public/assets/map/map.png"
    os.makedirs(tiles_dir, exist_ok=True)

    # Conversion MC → tile
    tile_x_start = floor(min(mc_x1, mc_x2) / tile_size)
    tile_y_start = floor(min(mc_z1, mc_z2) / tile_size) + 3
    tile_x_end = floor(max(mc_x1, mc_x2) / tile_size)
    tile_y_end = floor(max(mc_z1, mc_z2) / tile_size) + 3

    # Télécharge une tuile pour connaître la taille en pixels
    test_tile_url = f"{base_url}/tiles/{world}/flat/{tile_x_start}_{tile_y_start}.png"
    test_tile_path = os.path.join(tiles_dir, f"{tile_x_start}_{tile_y_start}.png")
    r = requests.get(test_tile_url)
    with open(test_tile_path, "wb") as f:
        f.write(r.content)
    with Image.open(test_tile_path) as test_img:
        tile_size_px = test_img.size[0]  # suppose carré

    width = (tile_x_end - tile_x_start + 1) * tile_size_px
    height = (tile_y_end - tile_y_start + 1) * tile_size_px
    final_image = Image.new("RGB", (width, height))

    for yi, tile_y in enumerate(reversed(range(tile_y_start, tile_y_end + 1))):
        for xi, tile_x in enumerate(range(tile_x_start, tile_x_end + 1)):
            tile_url = f"{base_url}/tiles/{world}/flat/{tile_x}_{tile_y}.png"
            local_path = os.path.join(tiles_dir, f"{tile_x}_{tile_y}.png")

            try:
                r = requests.get(tile_url)
                if r.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(r.content)
                    try:
                        with Image.open(local_path) as tile_img:
                            final_image.paste(tile_img, (xi * tile_size_px, yi * tile_size_px))
                    except Exception as img_e:
                        print(f"❌ Erreur ouverture image {local_path} : {img_e}")
                else:
                    print(f"❌ Tuile absente : {tile_url}")
            except Exception as e:
                print(f"❌ Erreur {tile_x},{tile_y} : {e}")

    final_image.save(output_file)

    # Suppression du dossier temporaire et de son contenu
    import shutil
    if os.path.exists(tiles_dir):
        shutil.rmtree(tiles_dir)

fetch_and_merge_tiles_from_mc_coords("http://91.197.6.112:30603", "developper", -200, -300, 300, 200)