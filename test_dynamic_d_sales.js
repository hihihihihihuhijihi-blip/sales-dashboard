const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('function getCurrentDSales'));
const nodes = {};
const document = {
    getElementById: id => nodes[id] ||= {
        innerHTML: '', textContent: '', value: '', style: {},
        classList: { contains: () => id === 'direct-tab' }
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
};
let savedData = null;
const context = vm.createContext({
    console, document, setTimeout: callback => callback(),
    localStorage: {
        getItem: () => savedData,
        setItem: (_, value) => { savedData = value; },
        removeItem: () => { savedData = null; }
    }
});

vm.runInContext(source, context);
const checks = vm.runInContext(`
    directMonthlySales = { 7: { '浙江': 10 }, 8: { '浙江': 15 }, 9: { '浙江': 7 } };
    [[7, 'D4'], [8, 'D4'], [9, 'D5']].map(([month, segment]) => {
        selectedMonth = month; autoUpdateDSeg(); updateTableHeaders();
        return [selectedDSeg, document.getElementById('direct-dsales-header').innerHTML,
            getCurrentDSales('direct', '浙江')];
    });
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(checks)), [
    ['D4', 'D4累计<br>销售额/万', 10],
    ['D4', 'D4累计<br>销售额/万', 25],
    ['D5', 'D5累计<br>销售额/万', 7]
]);
assert.ok(html.indexOf('id="direct-dsales-header"') < html.indexOf('id="direct-dprogress-header"'));
assert.match(html, /const normalColCount = products.length \+ 5;/);
assert.ok(html.indexOf('formatDecimal(rowData.dSales)') < html.indexOf('drawPieChart(pie2X'));
console.log('dynamic D sales column: ok');

// Legacy data keeps its amounts; the new product participates in editing and totals.
const products = ['沙瑞环素', '吡美莫司', '皮肤处方药', '火把花根', '皮肤非药'];
const table = html.match(/<table class="data-table" id="direct-table">([\s\S]*?)<\/table>/)[1];
assert.deepEqual([...table.matchAll(/<th>(.*?)<\/th>/g)].map(m => m[1]), products);
assert.match(table, /colspan="5" id="direct-sales-header"/);
assert.equal([...table.matchAll(/<col style=/g)].length, 11);
savedData = JSON.stringify({
    version: 'v4', selectedMonth: 3, directRegions: ['浙江'], investmentRegions: [],
    directMonthlyData: { 3: { '浙江': { '吡美莫司': 8, '皮肤处方药': 3, '火把花根': 2, '皮肤非药': 1 } } },
    directMonthlySales: { 3: { '浙江': 14 } }
});
assert.equal(vm.runInContext('loadData()', context), true);
assert.equal(vm.runInContext("directData['浙江']['沙瑞环素']", context), 0);
vm.runInContext("updateDirectData('浙江', '沙瑞环素', '6.5'); loadData(); renderDirectTable();", context);
assert.equal(vm.runInContext("calculateRowTotal(directData, '浙江', DIRECT_PRODUCTS)", context), 20.5);
assert.equal(vm.runInContext("getCurrentDSales('direct', '浙江')", context), 20.5);
assert.equal(JSON.parse(savedData).directMonthlyData[3]['浙江']['沙瑞环素'], 6.5);
assert.deepEqual([...nodes['direct-tbody'].innerHTML.matchAll(/value="([^" ]+)"/g)].map(m => +m[1]), [6.5, 8, 3, 2, 1]);
assert.match(nodes['direct-tfoot'].innerHTML, /<td>6.50<\/td><td>8.00<\/td><td>3.00<\/td><td>2.00<\/td><td>1.00<\/td><td>20.50<\/td>/);
console.log('direct product order, legacy data, editing, persistence and totals: ok');
