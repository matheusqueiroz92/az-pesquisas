# Exemplos congelados — contratos v1

Estes arquivos são o **contrato v1** em forma de exemplo. Um app instalado em campo envia e recebe exatamente este formato.

**Nunca edite estes arquivos para acompanhar uma mudança de schema.** Se um teste de `fixtures.test.ts` falhar depois de uma mudança, a mudança é incompatível com apps já instalados: crie `schemaVersion: 2` e mantenha a leitura da v1 (spec 006, regra 3).
