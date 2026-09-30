const assert = require('node:assert/strict');
const {parse} = require('./static/quota_import.js');

const vertical = [
  'Norte\tP.O.\tCUOTA / P.O.\tCASOS PROYECTADOS',
  'H 25 a 34\t382.100\t2%\t7',
  'M Más 65\t90.100\t0%\t2',
  'TOTAL\t3.417.300\t0,00%\t62',
  'Sur\tP.O.\tCUOTA / P.O.\tCASOS PROYECTADOS',
  'H 35 a 44\t490.000\t2%\t9',
].join('\n');

const parsedVertical = parse(vertical);
assert.equal(parsedVertical.format, 'vertical');
assert.deepEqual(parsedVertical.rows, [
  {region:'Norte',gender:'H',age:'25 a 34',cases:7,universe:382100,percentage:2},
  {region:'Norte',gender:'M',age:'Más 65',cases:2,universe:90100,percentage:0},
  {region:'Sur',gender:'H',age:'35 a 44',cases:9,universe:490000,percentage:2},
]);

const horizontal = [
  '\tNorte\t\t',
  '\tH 25 a 34\tM Más 65',
  'Universo\t382.100\t90.100',
  'Cuota / PO\t2%\t0%',
  'Casos\t7\t2',
  '\tMetropolitano\t\t',
  '\tH 25 a 34\tM Más 65',
  'Universo\t1.400.000\t441.300',
  'Cuota / PO\t7%\t2%',
  'Casos\t26\t8',
].join('\n');

const parsedHorizontal = parse(horizontal);
assert.equal(parsedHorizontal.format, 'horizontal');
assert.deepEqual(parsedHorizontal.rows, [
  {region:'Norte',gender:'H',age:'25 a 34',cases:7,universe:382100,percentage:2},
  {region:'Norte',gender:'M',age:'Más 65',cases:2,universe:90100,percentage:0},
  {region:'Metropolitano',gender:'H',age:'25 a 34',cases:26,universe:1400000,percentage:7},
  {region:'Metropolitano',gender:'M',age:'Más 65',cases:8,universe:441300,percentage:2},
]);

console.log('quota_import: ok');
