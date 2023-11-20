// CÓDIGO PARA EXTRAIR DADOS AGROCLIMATÓLOGICOS EM UMA REGIÃO

// Carrega a região
var regiao = ee.FeatureCollection('projects/ee-l247008/assets/3')
Map.addLayer(regiao, { color: 'blue' }, 'POA')
Map.centerObject(regiao)

// Dados do ERA5
var dataset = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    .filterBounds(regiao)
    .filterDate('2023-01-01', '2023-09-30')
    .select(['surface_net_solar_radiation_sum', 'surface_net_thermal_radiation_sum'])

print('Quantidade de imagens:', dataset.size())

// Formatar a data em um forma de tabela
function formatDate(img) {
    var millis = img.date().millis().format();
    return ee.String('Date(').cat(millis).cat(')');
}

// O map é uma estrutura de repetição
var reductionTable = ee.ImageCollection(dataset).map(function (img) {
    //Reduz a imagem para média de pixels que cruzam a região 
    var stat = img.reduceRegion(
        { reducer: ee.Reducer.mean(), geometry: regiao, scale: 1000 });
    var date = formatDate(img);
    var Sradiation = stat.get('surface_net_solar_radiation_sum');
    var termal = stat.get('surface_net_thermal_radiation_sum');
    var row = ee.List([date, Sradiation, termal]);
    return ee.Feature(null, { 'row': row });
});

var dataTableServer = reductionTable.aggregate_array('row');

var columnHeader = ee.List([[
    { label: 'Date', role: 'domain', type: 'date' },
    { label: 'surface_net_solar_radiation_sum', role: 'data', type: 'number' },
    { label: 'surface_net_thermal_radiation_sum', role: 'data', type: 'number' },
]]);

dataTableServer = columnHeader.cat(dataTableServer);
print(dataTableServer)

dataTableServer.evaluate(function (dataTableClient) {
    var chart = ui.Chart(dataTableClient).setChartType('ComboChart')
        .setSeriesNames(['surface_net_solar_radiation_sum', 'surface_net_thermal_radiation_sum'])
        .setOptions({
            title: 'Valores de Radiação Solar',
            hAxis: {
                title: 'Date',
                titleTextStyle: { italic: false, bold: true },
            },
            series: {
                1: {
                    targetAxisIndex: 1,
                    type: 'line',
                    color: 'red'
                },
                0: {
                    targetAxisIndex: 0,
                    type: 'line',
                    color: 'green'
                }
            },
            vAxis: {
                1: { title: 'Temp. máx (ºC)', titleTextStyle: { italic: false, bold: true } },
                0: { title: 'Temp. média (ºC)', titleTextStyle: { italic: false, bold: true } },
            },
            poinSize: 1,
            lineWidth: 1,
            bar: { groupwidth: '100%' },
            colors: ['e37d05', '1d6b99'],
            curveType: 'function'
        });
    print(chart);
});

