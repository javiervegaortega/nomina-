export const COMPANIES = [
  { id: 'proquima', name: 'PROQUIMA', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { id: 'unhesa', name: 'UNHESA', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 'unhesaLiq', name: 'UNHESA LIQ.', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
  { id: 'econacional', name: 'ECONACIONAL', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  { id: 'ecomezclas', name: 'ECOMEZCLAS', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
];

export const DEPARTMENTS = [
  'PRESIDENCIA',
  'ADMINISTRATIVO',
  'CONTABILIDAD Y FINANZAS',
  'INVESTIGACION Y DESARROLLO',
  'CONTROL DE CALIDAD',
  'INFORMATICA',
  'RECURSOS HUMANOS',
  'VENTAS',
  'PRODUCCION',
];

export const EMPLOYEES = [
  { id: 1, name: 'Estrada Robles Victor Gerardo', role: 'Presidente', dept: 'PRESIDENCIA', company: 'UNHESA', base: 19750, bonus: 250, days: 30, status: 'active', bankAccount: '4510765', bankName: 'PROMERICA', igssNumber: '12345678', dist: { proquima: 0, unhesa: 100, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 2, name: 'Estrada Robles Victor Gerardo', role: 'Gerente General', dept: 'PRESIDENCIA', company: 'PROQUIMA', base: 61000, bonus: 250, days: 30, status: 'active', bankAccount: '4510766', bankName: 'PROMERICA', igssNumber: '12345679', dist: { proquima: 100, unhesa: 0, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 3507.50, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 3, name: 'Estrada Robles Juan Pablo', role: 'Asesor', dept: 'PRESIDENCIA', company: 'PROQUIMA', base: 15000, bonus: 155000, days: 30, status: 'active', bankAccount: '143132884', bankName: 'INDUSTRIAL', igssNumber: '12345680', dist: { proquima: 100, unhesa: 0, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 15719.44, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 4, name: 'Alvarez Caceros Genesis Arleth', role: 'Asistente de Gerencia', dept: 'PRESIDENCIA', company: 'PROQUIMA', base: 3500, bonus: 1500, days: 30, status: 'active', bankAccount: '4510768', bankName: 'BANTRAB', igssNumber: '12345681', dist: { proquima: 50, unhesa: 50, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 41.55, bank: 0, cell: 0, cafe: 17, product: 165, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 5, name: 'Muñoz Laparra Orly Gabriela', role: 'Asistente', dept: 'PRESIDENCIA', company: 'UNHESA', base: 5000, bonus: 4000, days: 30, status: 'active', bankAccount: '4510769', bankName: 'PROMERICA', igssNumber: '12345682', dist: { proquima: 35, unhesa: 35, unhesaLiq: 0, econacional: 30, ecomezclas: 0 }, deductions: { isr: 237.93, bank: 0, cell: 0, cafe: 80, product: 0, insurance: 75, other: 240, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 6, name: 'Quevedo Lopez Ingrid Aracely', role: 'Conserje', dept: 'PRESIDENCIA', company: 'UNHESA', base: 3166.38, bonus: 250, days: 30, status: 'active', bankAccount: '4510770', bankName: 'INDUSTRIAL', igssNumber: '12345683', dist: { proquima: 0, unhesa: 100, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 7, name: 'Morales Alvarez Yony', role: 'Conserje', dept: 'PRESIDENCIA', company: 'UNHESA', base: 3166.38, bonus: 250, days: 30, status: 'active', bankAccount: '4510771', bankName: 'PROMERICA', igssNumber: '12345684', dist: { proquima: 0, unhesa: 100, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 8, name: 'Veliz Carias Elder Danilo', role: 'Piloto', dept: 'PRESIDENCIA', company: 'UNHESA', base: 3166.38, bonus: 250, days: 30, status: 'active', bankAccount: '4510772', bankName: 'BANTRAB', igssNumber: '12345685', dist: { proquima: 0, unhesa: 100, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 9, name: 'Alvarez Fajardo Erick Geovanni', role: 'Piloto', dept: 'PRESIDENCIA', company: 'PROQUIMA', base: 3166.38, bonus: 1540.76, days: 9, status: 'inactive', bankAccount: '4510773', bankName: 'PROMERICA', igssNumber: '12345686', dist: { proquima: 100, unhesa: 0, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 10, name: 'Gaitan Hernandez Luis Daniel', role: 'Piloto de Presidencia', dept: 'ADMINISTRATIVO', company: 'PROQUIMA', base: 3262.50, bonus: 2250, days: 30, status: 'active', bankAccount: '4510774', bankName: 'INDUSTRIAL', igssNumber: '12345687', dist: { proquima: 100, unhesa: 0, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 67.75, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 11, name: 'Saenz Lemus Dulce Maria', role: 'Recepcionista', dept: 'ADMINISTRATIVO', company: 'PROQUIMA', base: 3166.38, bonus: 250, days: 30, status: 'active', bankAccount: '4510775', bankName: 'PROMERICA', igssNumber: '12345688', dist: { proquima: 50, unhesa: 50, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 12, name: 'Pu Canto Domingo', role: 'Conserje', dept: 'ADMINISTRATIVO', company: 'PROQUIMA', base: 3166.38, bonus: 250, days: 30, status: 'active', bankAccount: '4510776', bankName: 'PROMERICA', igssNumber: '12345689', dist: { proquima: 50, unhesa: 50, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 0, cell: 0, cafe: 0, product: 82.50, insurance: 50, other: 306.62, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 13, name: 'Patzan Quib Lucrecia', role: 'Contador General', dept: 'CONTABILIDAD Y FINANZAS', company: 'UNHESA', base: 10036.54, bonus: 657.70, days: 30, status: 'active', bankAccount: '4510777', bankName: 'BANTRAB', igssNumber: '12345690', dist: { proquima: 45, unhesa: 45, unhesaLiq: 0, econacional: 10, ecomezclas: 0 }, deductions: { isr: 310.47, bank: 1484.26, cell: 796, cafe: 0, product: 0, insurance: 100, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 14, name: 'Lorenzana Gonzalez Cesar Leonel', role: 'Gerente Financiero', dept: 'CONTABILIDAD Y FINANZAS', company: 'UNHESA', base: 18000, bonus: 5000, days: 30, status: 'active', bankAccount: '4510778', bankName: 'PROMERICA', igssNumber: '12345691', dist: { proquima: 60, unhesa: 30, unhesaLiq: 0, econacional: 10, ecomezclas: 0 }, deductions: { isr: 906.53, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 150, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 15, name: 'De Floran Rodas Luis Arnau', role: 'Jefe I & D', dept: 'INVESTIGACION Y DESARROLLO', company: 'PROQUIMA', base: 8000, bonus: 3000, days: 30, status: 'active', bankAccount: '4510779', bankName: 'INDUSTRIAL', igssNumber: '12345692', dist: { proquima: 100, unhesa: 0, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 330.68, bank: 0, cell: 0, cafe: 30, product: 0, insurance: 100, other: 240, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 16, name: 'Saban Culajay Edson Omar', role: 'Jefe de Gestión de Calidad', dept: 'CONTROL DE CALIDAD', company: 'PROQUIMA', base: 5250, bonus: 2750, days: 30, status: 'active', bankAccount: '4510780', bankName: 'PROMERICA', igssNumber: '12345693', dist: { proquima: 35, unhesa: 60, unhesaLiq: 0, econacional: 5, ecomezclas: 0 }, deductions: { isr: 187.32, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 75, other: 240, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 17, name: 'Jimenez Sosa Luis Eduardo', role: 'Jefe de Informática', dept: 'INFORMATICA', company: 'PROQUIMA', base: 7000, bonus: 5250, days: 30, status: 'active', bankAccount: '640000414', bankName: 'PROMERICA', igssNumber: '12345694', dist: { proquima: 45, unhesa: 40, unhesaLiq: 0, econacional: 15, ecomezclas: 0 }, deductions: { isr: 395.60, bank: 1491.76, cell: 0, cafe: 0, product: 0, insurance: 150, other: 187.50, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 18, name: 'Cabrera Guzman Javier Antonio', role: 'Analista Programador', dept: 'INFORMATICA', company: 'PROQUIMA', base: 3459.24, bonus: 1250, days: 30, status: 'active', bankAccount: '4510782', bankName: 'PROMERICA', igssNumber: '12345695', dist: { proquima: 45, unhesa: 40, unhesaLiq: 0, econacional: 15, ecomezclas: 0 }, deductions: { isr: 27.11, bank: 0, cell: 0, cafe: 445.50, product: 0, insurance: 50, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 19, name: 'Guerra Lopez Jonathan Otoniel', role: 'Analista Programador', dept: 'INFORMATICA', company: 'PROQUIMA', base: 4750, bonus: 1250, days: 30, status: 'active', bankAccount: '4510783', bankName: 'BANTRAB', igssNumber: '12345696', dist: { proquima: 45, unhesa: 40, unhesaLiq: 0, econacional: 15, ecomezclas: 0 }, deductions: { isr: 88.53, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 }, extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
  { id: 20, name: 'Guzman Hernandez Edgar Geovanni', role: 'Auxiliar de Control de Calidad', dept: 'CONTROL DE CALIDAD', company: 'PROQUIMA', base: 3166.38, bonus: 600, days: 30, status: 'active', bankAccount: '4510784', bankName: 'PROMERICA', igssNumber: '12345697', dist: { proquima: 60, unhesa: 40, unhesaLiq: 0, econacional: 0, ecomezclas: 0 }, deductions: { isr: 0, bank: 702.56, cell: 0, cafe: 131.75, product: 82.50, insurance: 110, other: 125, shoes: 0, uniform: 0 }, extras: { simplesQty: 1, simplesVal: 19.79, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 } },
];

export const CUOTA_PATRONAL_RATE = 0.1267;
export const CUOTA_LABORAL_RATE = 0.0483;

// Cálculo de ISR Mensual (Régimen de Asalariados - Guatemala)
export const calculateMonthlyISR = (baseMonthly, bonusMonthly = 250) => {
  const annualIncome = (baseMonthly + bonusMonthly) * 12;
  const annualIgss = baseMonthly * CUOTA_LABORAL_RATE * 12;
  const personalExpenses = 48000;
  const taxableIncome = annualIncome - annualIgss - personalExpenses;

  if (taxableIncome <= 0) return 0;

  let annualIsr = 0;
  if (taxableIncome <= 300000) {
    annualIsr = taxableIncome * 0.05;
  } else {
    annualIsr = 15000 + ((taxableIncome - 300000) * 0.07);
  }

  return annualIsr / 12;
};

export function calcTotal(emp) {
  // Proporción de días laborados
  const baseFactor = (emp.days || 30) / 30;
  
  // Ingresos
  const baseSalary = emp.base * baseFactor;
  const bonificacion = emp.bonus * baseFactor;
  const extrasAndCommissions = (emp.extras?.simplesVal || 0) + (emp.extras?.doblesVal || 0) + (emp.extras?.comisiones || 0) + (emp.extras?.otrosIngresos || 0);
  
  const grossBase = baseSalary + bonificacion + extrasAndCommissions;
  
  // Egresos (Deducciones)
  const patronal = baseSalary * CUOTA_PATRONAL_RATE;
  const igssLaboral = baseSalary * CUOTA_LABORAL_RATE; // 4.83%
  
  const customDeds = Object.values(emp.deductions).reduce((a, b) => a + b, 0);
  const totalDeductions = customDeds + igssLaboral;
  
  const netPay = grossBase - totalDeductions;
  
  // Distribución en quincenas (Mitad de líquido aproximado o 50% de devengado, ajustando en 2da quincena)
  // Según Excel, normalmente la 1ra quincena es el 50% del salario neto proyectado (o un anticipo fijo)
  // Para el mock, asumiremos que es el 50% del netPay
  const primeraQuincena = netPay > 0 ? netPay / 2 : 0;
  const segundaQuincena = netPay > 0 ? netPay - primeraQuincena : 0;

  return { 
    grossBase, 
    patronal, 
    igssLaboral, 
    totalDeductions, 
    netPay,
    primeraQuincena,
    segundaQuincena
  };
}

export function formatQ(num) {
  if (isNaN(num)) return 'Q 0.00';
  return 'Q ' + num.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
