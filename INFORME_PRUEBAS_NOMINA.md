# Informe de Pruebas — Sistema de Nómina (2da corrida)

**Fecha:** 17 de julio de 2026  
**Alcance:** Las 6 empresas del Directorio de Empresas (captura UI) y todos sus empleados con `empresa_principal` + sueldo > 0.

---

## Directorio de empresas (6 registros — como en UI)

| ID | NIT | Nombre comercial | Empleados en nómina | Resultado E2E |
|----|-----|------------------|---------------------|---------------|
| 1 | 24612227 | PROQUIMA,S.A. | **80** | 1ra + 2da + billing + reactivación OK |
| 2 | 23038187 | UNION HERMANOS,S.A. | **86** | 1ra + 2da + billing + reactivación OK |
| 3 | 75364255 | ECONACIONAL,S.A. | **67** | 1ra + 2da + billing + reactivación OK |
| 4 | 86417177 | CLEARTEC, S. A. | **0** | SKIP — sin empleados asignados |
| 5 | 69063427 | CALIDUL | **0** | SKIP — sin empleados asignados |
| 6 | N/A | HIDROXON | **0** | SKIP — sin empleados asignados |

**Total empleados procesados:** 233 (80 + 86 + 67)  
**Assertions E2E:** 110 passed, 0 failed

---

## Limpieza previa

Tablas transaccionales vaciadas a 0: `billing_run_lines`, `billing_runs`, `payroll_drafts`, `payrollhistories`, `operation_logs`, `operation_batches`, `commissions`.

Maestros intactos: usuarios, empleados, departamentos, las 6 empresas, catálogo de bonos, reglas billing.

---

## Ciclo por empresa (con empleados)

Para **PROQUIMA**, **UNION HERMANOS** y **ECONACIONAL** se ejecutó el ciclo completo con **todos** los empleados de cada empresa:

1. Bonos catálogo + comisión + lote operativo (HE + bono)
2. Validación negativa (400)
3. Aprobación gerente
4. Borrador 1ra quincena (100% empleados)
5. Auditoría: rechazo → corrección → aprobación
6. Cierre 1ra + facturación intercompañías (todos los empleados en preview)
7. Borrador 2da con anticipos de 1ra (80/86/67 empleados con `anticipo1ra`)
8. Cierre 2da + billing
9. Reactivación 2da cerrada

---

## Empresas sin nómina posible

**CLEARTEC, CALIDUL e HIDROXON** existen en el directorio pero **no tienen ningún empleado** con:

- `empresa_principal` = ID de la empresa (4, 5 o 6)
- `sueldo_ordinario` > 0

El sistema de nómina filtra empleados por `empresa_principal` (igual que la UI en `/payroll`). **No se puede crear nómina** para esas empresas hasta que se asignen empleados en **Empleados → empresa principal**.

---

## Cómo repetir

```powershell
cd c:\xampp\htdocs\nomina\backend
npm run preflight
node src/scripts/cleanup_payroll_data.js --confirm
npm run test:e2e:all
```

Una sola empresa:

```powershell
node src/scripts/test_e2e_all_companies.js --company=1
```

---

## Conclusión

Se reprocesó desde cero usando las **6 empresas del directorio**. Las **3 empresas con plantilla** completaron el flujo end-to-end con **233 empleados**. Las otras **3 empresas requieren asignación de empleados** en el maestro antes de poder generar nóminas.
