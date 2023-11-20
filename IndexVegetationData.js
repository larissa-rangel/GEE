//ADICIONA UMA CAMADA NO MAPA REFERENTE AO MUNICIPIO 
Map.addLayer(regiao, { color: 'blue' }, 'POA')
//INICIALIZA O MAPA NA REGIÃO SELECIONADA
Map.centerObject(regiao)

// Baixa o dataset de imagens do sentinel 
// filter.bounds -> só para região de interesse 
// filterDate -> filtra só a data de interesse 
// ee.Filter.lt -> filtra imagens que tem até 1% de nuvem 
// select -> pega somente as bandas B
// sort -> ordena as imagens do menor percentual de nuvem para o maior

var collection = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
    .filterBounds(regiao)
    .filterDate('2023-01-01', '2023-09-30')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 1))
    .select(['B.*'])
    .sort('CLOUDY_PIXEL_PERCENTAGE')


//QUANTIDADE DE IMAGEN SEM INTEREFRÊNCIA DE NUVEM                          
print('Imagens sem interferência de nuvens', collection.size())

//FUNÇÃO PARA APLICAR O FATOR DE ESCALA EM TODAS AS IMAGENS 
function scale(image) {
    return image.multiply(0.0001).clip(regiao).copyProperties(image, image.propertyNames()) //COPIA AS PROPRIEDADES DA IMAGEM
        .set({ data: image.date().format('YYYY-MM-DD') })
}

//APLICAR O FATOR DE ESCALA
var collection_scales = collection.map(scale)

//Variáveis candidatas: NDVI, NDRE, EVI, NDWI, NDMI

//FUNÇÃO PARA CALCULAR O NDVI PARA TODAS AS IMAGENS
function indice1(image) {
    var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return image.addBands(ndvi)
}

//FUNÇÃO PARA CALCULAR O NDMI PARA TODAS AS IMAGENS
function indice2(image) {
    var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI')
    return image.addBands(ndmi)
}

//FUNÇÃO PARA CALCULAR O EVI PARA TODAS AS IMAGENS
function indice3(image) {
    var evi = image.expression(
        '2.5*((NIR-RED) / (NIR + 6* RED -7.5 * BLUE +1))',
        {
            'NIR': image.select('B8').divide(10000),
            'RED': image.select('B4').divide(10000),
            'BLUE': image.select('B2').divide(10000)
        }
    )
    return image.addBands(evi.rename("EVI"));
}

//FUNÇÃO PARA CALCULAR O NDwI PARA TODAS AS IMAGENS
function indice4(image) {
    var ndwi = image.normalizedDifference(['B8A', 'B10']).rename('NDWI')
    return image.addBands(ndwi)
}

//FUNÇÃO PARA CALCULAR O NDRE PARA TODAS AS IMAGENS
function indice5(image) {
    var ndre = image.normalizedDifference(['B8', 'B9']).rename('NDRE')
    return image.addBands(ndre)
}

//APLICAR OS INDICES DE VEGETAÇÃO
collection_scales = collection_scales.map(indice1).map(indice2).map(indice3).map(indice4).map(indice5)

//Mostrar as bandas da primeira imagem
print('Bandas', collection_scales.first().bandNames())

//Adicionar uma camada de NDVI
Map.addLayer(collection_scales.select('NDVI'), { palette: ['red', 'yellow', 'green'], min: -1, max: 1 }, 'Sentinel NDVI')

//Adicionar uma camada de EVI
Map.addLayer(collection_scales.select('EVI'), { palette: ['blue', 'white', 'green'], min: -1, max: 1 }, 'Sentinel EVI')

//Adicionar uma camada de NDMI
Map.addLayer(collection_scales.select('NDMI'), { palette: ['purple', 'blue', 'yellow'], min: -1, max: 1 }, 'Sentinel NDMI')

//Adicionar uma camada de NDWI
Map.addLayer(collection_scales.select('NDWI'), { palette: ['purple', 'blue', 'yellow'], min: -1, max: 1 }, 'Sentinel NDWI')

//Adicionar uma camada de NDRE
Map.addLayer(collection_scales.select('NDRE'), { palette: ['purple', 'blue', 'yellow'], min: -1, max: 1 }, 'Sentinel NDRE')

// Formatar a data em um forma de tabela
function formatDate(img) {
    var millis = img.date().millis().format();
    return ee.String('Date(').cat(millis).cat(')');
}

// O map é uma estrutura de repetição
var reductionTable = ee.ImageCollection(collection_scales).map(function (img) {
    var stat = img.reduceRegion(
        { reducer: ee.Reducer.mean(), geometry: regiao, scale: 1000 });

    // Extract the reduction results along with the image date.
    var date = formatDate(img);   // x-axis values.
    var ndvi = stat.get('NDVI');  // y-axis series 2 values.
    var ndmi = stat.get('NDMI');
    var evi = stat.get('EVI');  // y-axis series 2 values.
    var ndwi = stat.get('NDWI');
    var ndre = stat.get('NDRE');

    // Make a list of observation attributes to define a row in the DataTable.
    var row = ee.List([date, ndvi, ndmi, evi, ndwi, ndre]);

    // Return the row as a property of an ee.Feature.
    return ee.Feature(null, { 'row': row });
});

// Aggregate the 'row' property from all features in the new feature collection
// to make a server-side 2-D list (DataTable).
var dataTableServer = reductionTable.aggregate_array('row');

// Define column names and properties for the DataTable. The order should
// correspond to the order in the construction of the 'row' property above.
var columnHeader = ee.List([[
    { label: 'Date', role: 'domain', type: 'date' },
    { label: 'NDVI', role: 'data', type: 'number' },
    { label: 'NDMI', role: 'data', type: 'number' },
    { label: 'EVI', role: 'data', type: 'number' },
    { label: 'NDWI', role: 'data', type: 'number' },
    { label: 'NDRE', role: 'data', type: 'number' },

]]);

// Concatenate the column header to the table.
dataTableServer = columnHeader.cat(dataTableServer);
print(dataTableServer)


// Use 'evaluate' to transfer the server-side table to the client, define the
// chart and print it to the console.
dataTableServer.evaluate(function (dataTableClient) {
    var chart = ui.Chart(dataTableClient).setChartType('ComboChart')
        .setSeriesNames(['NDVI', 'NDMI', 'EVI', 'NDWI', 'NDRE'])
        .setOptions({
            title: 'Valor médio dos indices de vegetação para ID3',
            hAxis: {
                title: 'Date',
                titleTextStyle: { italic: false, bold: true },
            },
            series: {
                4: {
                    targetAxisIndex: 0,
                    type: 'bars',
                    color: 'purple'
                },
                3: {
                    targetAxisIndex: 0,
                    type: 'bars',
                    color: 'yellow'
                },
                2: {
                    targetAxisIndex: 0,
                    type: 'bars',
                    color: 'green'
                },
                1: {
                    targetAxisIndex: 0,
                    type: 'bars',
                    color: 'blue'
                },
                0: {
                    targetAxisIndex: 0,
                    type: 'bars',
                    color: 'red'
                }
            },
            vAxis: {
                4: { title: 'Vegetation index NDRE', titleTextStyle: { italic: false, bold: true } },
                3: { title: 'Vegetation index NDWI', titleTextStyle: { italic: false, bold: true } },
                2: { title: 'Vegetation index EVI', titleTextStyle: { italic: false, bold: true } },
                1: { title: 'Vegetation index NDMI', titleTextStyle: { italic: false, bold: true } },
                0: { title: 'Vegetation index NDVI', titleTextStyle: { italic: false, bold: true } },
            },
            pointSize: 1,
            lineWidth: 1,
            colors: ['e37d05', '1d6b99'],
            curveType: 'function'
        });
    print(chart);
});


// FUNÇÃO DE ESTATÍSTICA 


