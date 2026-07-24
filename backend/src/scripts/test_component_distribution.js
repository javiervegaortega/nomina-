const Decimal = require('decimal.js');
process.env.SKIP_DB_CONNECT_TEST = '1';
const BillingService = require('../services/billing.service');

const {
  allocateAmount,
  buildAllocations,
  buildComponentAllocations,
  canonicalBillingCompanyId,
  canonicalizeAllocations,
  getEmployeeBillingCostSnapshot,
  getPayrollCostComponents,
  netLegalCompanyMatrix,
  sumAllocationMaps
} = BillingService.__componentDistributionTest;

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
};

const mapTotal = (map) => [...map.values()].reduce(
  (sum, value) => sum.plus(value || 0),
  new Decimal(0)
);

const errors = [];
const general = buildAllocations({ 1: 50, 2: 50 }, 1, 'Prueba', errors);
assert(errors.length === 0, 'distribución general 50/50 válida');
const inexactGeneralErrors = [];
buildAllocations({ 1: 50, 2: 49.999 }, 1, 'Prueba inexacta', inexactGeneralErrors);
assert(
  inexactGeneralErrors.some((message) => /exactamente 100/.test(message)),
  'distribución general debe sumar exactamente 100%'
);

const fallbackMissing = buildComponentAllocations(
  'bonos',
  undefined,
  general,
  'Prueba',
  errors
);
const fallbackZero = buildComponentAllocations(
  'extras',
  { 1: 0, 2: 0 },
  general,
  'Prueba',
  errors
);
assert(fallbackMissing === general, 'override ausente usa distribución general');
assert(fallbackZero === general, 'override todo en 0 usa distribución general');

const validBonusOverride = buildComponentAllocations(
  'bonos',
  { 3: 100 },
  general,
  'Prueba',
  errors
);
assert(
  validBonusOverride.length === 1
  && validBonusOverride[0].toId === 3
  && validBonusOverride[0].pct === 100,
  'override de bonos al 100% se conserva'
);

const invalidErrors = [];
const invalidOverride = buildComponentAllocations(
  'extras',
  { 1: 60, 2: 30 },
  general,
  'Prueba inválida',
  invalidErrors
);
const invalidAllocation = allocateAmount(100, invalidOverride);
assert(invalidErrors.some((message) => /exactamente 100/.test(message)), 'override 90% queda bloqueado');
assert(mapTotal(invalidAllocation).equals(90), 'override inválido no se renormaliza a 100%');

const snapshot = {
  baseSalary: 1000,
  bonusDec: 250,
  bonusLey: 0,
  bonos: 100,
  bonusesSum: 50,
  extrasTotal: 200,
  igssBase: 1200,
  patronal: 128.04,
  irtraIntecap: 24,
  companyCost: 1752.04
};
const components = getPayrollCostComponents(snapshot);
assert(new Decimal(components.bonuses).equals(150), 'bonos operativos + catálogo, sin patronal');
assert(new Decimal(components.extrasEmployer).equals(25.34), 'extras reciben su carga patronal 12.67%');
assert(
  new Decimal(components.general)
    .plus(components.bonuses)
    .plus(components.extras)
    .equals(snapshot.companyCost),
  'componentes cierran exactamente contra companyCost'
);

const generalMap = allocateAmount(components.general, general);
const bonusMap = allocateAmount(components.bonuses, validBonusOverride);
const extrasMap = allocateAmount(
  components.extras,
  [{ toId: 2, pct: 100 }]
);
const assigned = sumAllocationMaps(generalMap, bonusMap, extrasMap);
assert(mapTotal(assigned).equals(snapshot.companyCost), 'asignación multi-componente cierra exactamente');
assert(new Decimal(assigned.get(3)).equals(150), 'destino de bonos recibe solo Q150, sin patronal');

const leylaEmployee = {
  sueldo_ordinario: 4100,
  bon_incentivo: 350,
  bon_dec_37_2001: 0,
  days: 30,
  extras: {
    bonos: 0,
    simplesVal: 691.875,
    doblesVal: 0,
    comisiones: 0,
    otrosIngresos: 0,
    vacacionesVal: 0,
    ventasEconomicas: 0
  },
  appliedBonuses: {},
  calculated: { igssExempt: false }
};
const leylaBilling = getEmployeeBillingCostSnapshot(leylaEmployee, {
  days: 30,
  baseSalary: 4100,
  bonusLey: 350,
  bonusDec: 0,
  bonos: 0,
  bonusesSum: 0,
  extrasTotal: 691.88
});
assert(
  new Decimal(leylaBilling.companyCost).equals('5749.0055625'),
  'caso Excel Leyla conserva precisión interna del costo empresa'
);
const leylaGeneral = buildAllocations({ 2: 40, 6: 60 }, 2, 'Leyla', []);
const leylaExtras = buildComponentAllocations(
  'extras',
  { 2: 100 },
  leylaGeneral,
  'Leyla',
  []
);
const leylaComponents = getPayrollCostComponents(leylaBilling);
const leylaAssigned = sumAllocationMaps(
  allocateAmount(leylaComponents.general, leylaGeneral),
  allocateAmount(leylaComponents.bonuses, leylaGeneral),
  allocateAmount(leylaComponents.extras, leylaExtras)
);
assert(
  new Decimal(leylaAssigned.get(2)).equals('2767.3235625'),
  'caso Excel Leyla asigna Q2767.3235625 a Unhesa'
);
assert(
  new Decimal(leylaAssigned.get(6)).equals('2981.682'),
  'caso Excel Leyla asigna Q2981.682 a Hidroxon'
);
const leylaLegal = canonicalizeAllocations(leylaGeneral);
assert(
  leylaLegal.length === 1
  && leylaLegal[0].toId === 2
  && new Decimal(leylaLegal[0].pct).equals(100),
  'Hidroxon se conserva operativo pero consolida legalmente dentro de Unhesa'
);
assert(
  canonicalBillingCompanyId(5) === 2
  && canonicalBillingCompanyId(6) === 2,
  'Calidul e Hidroxon facturan como Unhesa'
);

const upNetting = netLegalCompanyMatrix({
  1: { 2: 63116.178515 },
  2: { 1: 60573.044743 }
});
assert(
  new Decimal(upNetting.netMatrix[1][2]).equals('2543.133772'),
  'neteo global UP deja una sola factura Proquima→Unhesa Q2543.133772'
);
assert(
  !upNetting.netMatrix[2]?.[1],
  'neteo global UP elimina la dirección recíproca'
);

console.log('Todas las pruebas de distribución por componente pasaron.');
