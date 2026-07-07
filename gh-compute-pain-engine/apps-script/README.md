# Google Apps Script

1. Obre [script.google.com](https://script.google.com).
2. Crea un projecte nou.
3. Enganxa el contingut de `Code.gs`.
4. Desa el projecte.
5. Executa `setupGhComputeLeadEngine`.
6. Autoritza el projecte quan Google ho demani.
7. Copia l'ID del full creat `GH Compute Lead Engine` des de la URL.
8. Configura aquest valor com a `GOOGLE_SHEET_ID` a l'entorn del servei n8n.

El script és idempotent: afegeix pestanyes, columnes, validacions, filtres i configuració inicial sense eliminar dades operatives existents.
