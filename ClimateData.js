// CÓDIGO PARA EXTRAIR DADOS AGROCLIMATÓLOGICOS EM UMA REGIÃO

// Carrega a região
var regiao = ee.FeatureCollection('projects/ee-l247008/assets/3')
Map.addLayer(regiao, { color: 'blue' }, 'POA')
Map.centerObject(regiao)

// Dados do ERA5
var dataset = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    //var dataset = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H")
    .filterBounds(regiao)
    .filterDate('2023-01-01', '2023-09-30')
    .select(['total_evaporation_sum', 'total_precipitation_sum'])

print('Quantidade de imagens:', dataset.size())

// Função que calcula a preciptação acumulada
function Pmean(image) {
    var precip_mean = image.expression(
        'precipitation*1000',
        {
            'precipitation': image.select('total_precipitation_sum')
        }).rename('Pmean')

    return image.addBands(precip_mean).clip(regiao)
        .copyProperties(image, image.propertyNames())
        .set({ date: image.date().format('yyyy-MM-dd') })
}


// Função que calcula a evapotranspiração acumulada
function Emean(image) {
    var evapotransp_mean = image.expression(
        'Evapo*1000',
        {
            'Evapo': image.select('total_evaporation_sum')
        }).rename('Emean')

    return image.addBands(evapotransp_mean).clip(regiao)
        .copyProperties(image, image.propertyNames())
        .set({ date: image.date().format('yyyy-MM-dd') })
}

//Aplicando as funções Pmean, Tmean e Emean
var new_dataset = dataset.map(Pmean).map(Emean)

print('Quantidade de imagens do novo dataset:', new_dataset.size())

//Mostrar as bandas da primeira imagem
print('Bandas', new_dataset.first().bandNames())

//Mostrar as bandas da primeira imagem
print('Visualizar dataset modificado', new_dataset.limit(3))

// Formatar a data em um forma de tabela
function formatDate(img) {
    var millis = img.date().millis().format();
    return ee.String('Date(').cat(millis).cat(')');
}

// O map é uma estrutura de repetição
var reductionTable = ee.ImageCollection(new_dataset).map(function (img) {
    //Reduz a imagem para média de pixels que cruzam a região 
    var stat = img.reduceRegion(
        { reducer: ee.Reducer.mean(), geometry: regiao, scale: 1000 });
    var date = formatDate(img);
    var Nprecip_mean = stat.get('Pmean');
    var Nevapotransp_mean = stat.get('Emean');
    var row = ee.List([date, Nprecip_mean, Nevapotransp_mean]);
    return ee.Feature(null, { 'row': row });
});

var dataTableServer = reductionTable.aggregate_array('row');

var columnHeader = ee.List([[
    { label: 'Date', role: 'domain', type: 'date' },
    { label: 'Pmean', role: 'data', type: 'number' },
    { label: 'Emean', role: 'data', type: 'number' },
]]);

dataTableServer = columnHeader.cat(dataTableServer);
print(dataTableServer)

dataTableServer.evaluate(function (dataTableClient) {
    var chart = ui.Chart(dataTableClient).setChartType('ComboChart')
        .setSeriesNames(['Pmean', 'Emean'])
        .setOptions({
            title: 'Valores de Precipitação e Evapotranspiração',
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
                    color: 'blue'
                }
            },
            vAxis: {
                1: { title: 'Evapotranspiração (mm)', titleTextStyle: { italic: false, bold: true } },
                0: { title: 'Precipitação (mm)', titleTextStyle: { italic: false, bold: true } },
            },
            poinSize: 1,
            lineWidth: 1,
            bar: { groupwidth: '100%' },
            colors: ['e37d05', '1d6b99'],
            curveType: 'function'
        });
    print(chart);
});

