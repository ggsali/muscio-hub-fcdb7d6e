# H2C-Profile (Bambu Studio, Export aus SimplyPrint)

Maschine und vier Prozess-Presets fuer den Bambu Lab H2C, damit der Slicer-Dienst den Drucker `h2c` bekommt.

| Datei | Inhalt |
|---|---|
| `machine_Bambu_Lab_H2C.json` | Maschine «Bambu Lab H2C», Varianten 0.2/0.4/0.6/0.8 mm (normal und Hochfluss). Bauraum 330 x 320 mm, Hoehe 325 mm |
| `process_0.20mm_High_Quality_BBL_H2C.json` | Preset «0.20mm High Quality @BBL H2C» |
| `process_0.08mm_Detail.json` | Preset «0.08mm Detail» (Basis 0.08mm High Quality @BBL H2C) |
| `process_0.16mm_TPU.json` | Preset «0.16mm TPU» (Basis 0.16mm High Quality @BBL H2C) |
| `process_0.20mm_gute_stuetzen.json` | Preset «0.20mm gute stützen» (nur Stuetzen auf der Bauplatte, 30 Grad, Stuetzen-Ironing, langsamere erste Schicht) |

Format: SimplyPrint-Export, die eigentlichen Slicer-Werte stehen unter `settings` (Maschine: `profile.variants[].settings`).
Quelle: Bambu Studio 02.07 bis 02.09, der Slicer-Dienst nutzt OrcaSlicer 2.4.2 (kennt kein H2C, nur H2D und H2S). Fuer einfarbiges Slicen reicht der erste Extruder.
