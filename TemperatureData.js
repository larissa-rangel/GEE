// CÓDIGO PARA EXTRAIR DADOS AGROCLIMATÓLOGICOS EM UMA REGIÃO

// Carrega a região
var regiao = ee.FeatureCollection('projects/ee-l247008/assets/3')
Map.addLayer(regiao, { color: 'blue' }, 'POA')
Map.centerObject(regiao)

// Dados do ERA5
var dataset = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    .filterBounds(regiao)
    .filterDate('2023-01-01', '2023-09-30')
    .select(['temperature_2m_max', 'temperature_2m_min'])

print('Quantidade de imagens:', dataset.size())

// Função que calcula a temperatura média
function Tmean(image) {
    var temp_mean = image.expression(
        '((tmax+tmin)/2) - 273.15',
        {
            'tmax': image.select('temperature_2m_max'),
            'tmin': image.select('temperature_2m_min')
        }).rename('Tmean')

    return image.addBands(temp_mean).clip(regiao)
        .copyProperties(image, image.propertyNames())
        .set({ date: image.date().format('yyyy-MM-dd') })
}
// Função que calcula a temperatura média
function Tmax(image) {
    var temp_max = image.expression(
        '(tmax) - 273.15',
        {
            'tmax': image.select('temperature_2m_max')
        }).rename('Tmax')

    return image.addBands(temp_max).clip(regiao)
        .copyProperties(image, image.propertyNames())
        .set({ date: image.date().format('yyyy-MM-dd') })
}

// Função que calcula a temperatura média
function Tmin(image) {
    var temp_min = image.expression(
        '(tmin) - 273.15',
        {
            'tmin': image.select('temperature_2m_min')
        }).rename('Tmin')

    return image.addBands(temp_min).clip(regiao)
        .copyProperties(image, image.propertyNames())
        .set({ date: image.date().format('yyyy-MM-dd') })
}
//Aplicando as funções Tmean, tmax,tmin
var new_dataset = dataset.map(Tmean).map(Tmax).map(Tmin)

print('Quantidade de imagens do novo dataset:', dataset.size())

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
    var NTemp_mean = stat.get('Tmean');
    var NTemp_max = stat.get('Tmax');
    var NTemp_min = stat.get('Tmin');
    var row = ee.List([date, NTemp_mean, NTemp_max, NTemp_min]);
    return ee.Feature(null, { 'row': row });
});

var dataTableServer = reductionTable.aggregate_array('row');

var columnHeader = ee.List([[
    { label: 'Date', role: 'domain', type: 'date' },
    { label: 'Tmean', role: 'data', type: 'number' },
    { label: 'Tmax', role: 'data', type: 'number' },
    { label: 'Tmin', role: 'data', type: 'number' },
]]);

dataTableServer = columnHeader.cat(dataTableServer);
print(dataTableServer)

dataTableServer.evaluate(function (dataTableClient) {
    var chart = ui.Chart(dataTableClient).setChartType('ComboChart')
        .setSeriesNames(['Tmean', 'Tmax', 'Tmin'])
        .setOptions({
            title: 'Valores de Temperatura média, máx. e min.',
            hAxis: {
                title: 'Date',
                titleTextStyle: { italic: false, bold: true },
            },
            series: {
                2: {
                    targetAxisIndex: 0,
                    type: 'line',
                    color: 'blue'
                },
                1: {
                    targetAxisIndex: 0,
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
                2: { title: 'Temp. min (ºC)', titleTextStyle: { italic: false, bold: true } },
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

