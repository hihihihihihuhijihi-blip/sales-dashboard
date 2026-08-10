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
const context = vm.createContext({
    console, document,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
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
assert.match(html, /const normalColCount = 9;/);
assert.ok(html.indexOf('formatDecimal(rowData.dSales)') < html.indexOf('drawPieChart(pie2X'));
console.log('dynamic D sales column: ok');
