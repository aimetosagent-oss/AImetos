# Test cases

Casos minims coberts pel test local o pel contracte del workflow:

1. Empresa amb domini i CEO verificat.
2. Empresa amb Founder pero sense email.
3. Empresa amb diversos directors.
4. Empresa sense domini pero amb web.
5. Empresa sense dades suficients.
6. Apollo sense resultats.
7. API key incorrecta.
8. Rate limit.
9. Credits esgotats.
10. Error temporal 5xx.
11. Contacte ja enriquit.
12. Camp manual existent amb `OVERWRITE_EXISTING_CONTACT_DATA=false`.
13. Duplicat d'empresa.
14. Perfil que ja no treballa a l'empresa.
15. Empat entre dos candidats.

## Validacio local

Executa:

```bash
node tests/apollo-decision-maker-scoring.test.js
```

El test comprova:

- JSON importable i connexions coherents;
- absencia de secrets Apollo;
- capcaleres de `LEADS`;
- configuracio `CONFIG`;
- valors permesos d'estat;
- compilacio dels nodes Code;
- puntuacio i desempats deterministes.
