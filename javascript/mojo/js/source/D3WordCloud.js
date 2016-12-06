(function () {
    if (!mstrmojo.plugins.D3WordCloud) {
        mstrmojo.plugins.D3WordCloud = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.CustomVisBase",
        "mstrmojo.models.template.DataInterface"
    );

    mstrmojo.plugins.D3WordCloud.D3WordCloud = mstrmojo.declare(
        mstrmojo.CustomVisBase,
        null,
        {
            scriptClass: "mstrmojo.plugins.D3WordCloud.D3WordCloud",
            cssClass: "d3wordcloud",
            errorMessage: "Either there is not enough data to display the visualization or the visualization configuration is incomplete.",
            errorDetails: "This visualization requires one or more attributes and one metric.",
            externalLibraries: [{url: "http://d3js.org/d3.v3.min.js"}, {url: "file://../plugins/D3WordCloud/javascript/mojo/js/source/d3.layout.cloud.js"}],
            useRichTooltip: false,
            reuseDOMNode: false,
            setScaleValue: function setScaleValue(isScale) {
                var value = +this.getProperty("value");
                value = isScale ? ++value : --value;
                var properties = this.getProperties();
                properties["value"] = value;
                properties["scales"] = {inc: 'false', dec: 'false'};
            },
            plot: function () {
                /*
                 Originally created by Radha Krishnan Vinayagam on 7/26/2016.
                 */

                var is10point3 = typeof this.addThresholdMenuItem === 'function'; //True if we are using MSTR 10.3 or above
                var is10point4 = typeof this.getColorByAttInfo === 'function'; //True if we are using MSTR 10.4
                var isDocument = this.zonesModel;//undefined if it's a document
                var me = this;
                var defaultNumWords = 200;
                var defaultMinFontSize = 10;
                var defaultMaxFontSize = 70;
                var defaultWordPadding = 10;
                var adjustTooltipX = me.zonesModel ? 500 : 100; //if it's document adjustX = 100, in dashboard it's 500
                var adjustTooltipY = 50;
                var defaultScalingFactor = 5;
                var total_width = parseInt(me.width, 10);
                var total_height = parseInt(me.height, 10);
                var margin = {top: 20, right: 20, bottom: 20, left: 20};
                var width = total_width - margin.left - margin.right;
                var height = total_height - margin.top - margin.bottom;


                var color = d3.scale.category20(); //In MSTR 10.3 or older versions, default colors for words
                //In 10.4 default colors are obtained from colorByAttributes

                if (is10point3) {
                    me.setDefaultPropertyValues({
                        minfont: "10",
                        maxfont: "70",
                        numofwords: "200",
                        spiral: {a: "true", b: "false"},
                        defaultcolors: "false",
                        scales: {inc: "false", dec: "false"}
                    });
                    me.addThresholdMenuItem();
                }

                me.addUseAsFilterMenuItem();
                var properties = me.getProperties(); //var to store custom properties
                var dataConfig = {hasSelection: true};
                if (is10point3) {
                    dataConfig.hasThreshold = true;
                }
                if (is10point4 && isDocument) {
                    dataConfig.colorByInfo = me.zonesModel.getColorByAttributes();
                }

                var rawD = me.dataInterface.getRawData(mstrmojo.models.template.DataInterface.ENUM_RAW_DATA_FORMAT.ADV, dataConfig);

                var dataS = [];
                for (var i = 0; i < rawD.children.length; i++) {
                    var obj = {};
                    obj["text"] = rawD.children[i].name;
                    obj["value"] = rawD.children[i].value;
                    obj["index"] = i;
                    dataS.push(obj);
                }

                var maxvalue = is10point3 && me.getProperty("numofwords") ? +me.getProperty("numofwords") : defaultNumWords; //default number of words - 200, maximum number of words - 250
                maxvalue = dataS.length < maxvalue ? dataS.length : maxvalue; //if total number of words is < maxvalue, maxvalue is set to total num of words
                if (properties)
                    properties["numofwords"] = maxvalue.toString(); //to set the correct number of words in custom properties

                var sortedData = heapSort(dataS); // to sort the data and select maxvalue elements
                //sortedData will have the top maxvalue elements sorted in descending order.

                var maxfontsize = is10point3 && me.getProperty("maxfont") ? +me.getProperty("maxfont") : defaultMaxFontSize;
                var minfontsize = is10point3 && me.getProperty("minfont") ? +me.getProperty("minfont") : defaultMinFontSize;
                var fontscale = d3.scale.linear()
                    .domain([sortedData[0].value, sortedData[maxvalue - 1].value])
                    .range([maxfontsize, minfontsize]);
                var frequency_list = []; //data to be passed to the library
                var indexMap = {}; // to store attributeElement - index pair

                //to populate frequency_list var
                for (var i = 0, j = sortedData.length; i < sortedData.length; i++, j--) {
                    var obj = {};
                    obj["text"] = sortedData[i].text;
                    obj["size"] = fontscale(sortedData[i].value);
                    frequency_list.push(obj);
                    indexMap[obj.text] = sortedData[i].index; //index is the original index of the attribute element as assigned in DataInterface API
                }


                var div = d3.select(me.domNode).append("div")
                    .attr("class", "tip")
                    .style("opacity", 0);
                var chart = d3.select(me.domNode).select("svg");

                var scalingFactor = (is10point3 && me.getProperty("value") ? +me.getProperty("value") : defaultScalingFactor) / defaultScalingFactor;

                if (properties && typeof properties["value"] === 'undefined')
                    properties["value"] = defaultScalingFactor;

                //detailed description for each function is given here: https://github.com/jasondavies/d3-cloud
                var layout = d3.layout.cloud().size([width, height])
                    .timeInterval(1) //maximum amount of time that can be spent during the current timestep
                    .words(frequency_list)
                    .rotate(0)
                    .padding(defaultWordPadding) //to minimize overlapping of words
                    .text(function (d) {
                        return d.text;
                    })
                    .fontSize(function (d) {
                        return d.size;
                    });

                if (is10point3 && me.getProperty("textFont") && me.getProperty("textFont").fontFamily)
                    layout.font(me.getProperty("textFont").fontFamily);

                if (is10point3 && me.getProperty("spiral"))
                    layout.spiral(me.getProperty("spiral").a === "true" ? "archimedean" : "rectangular");

                layout.on("end", draw)
                    .start();


                function draw(words) {

                    try {
                        if (!chart.empty()) {
                            var e = me.domNode.querySelector(".wordcloud");
                            me.domNode.removeChild(e);
                        }
                        d3.select(me.domNode).append("svg")
                            .attr("width", total_width)
                            .attr("height", total_height)
                            .attr("class", "wordcloud")
                            .on("click", function (d) {
                                if (event.target.classList.contains('wordcloud')) {
                                    me.clearSelections();
                                    me.endSelections();
                                } else {
                                    return true;
                                }
                            })
                            .append("g")
                            // without the transform, words words would get cutoff to the left and top, they would
                            // appear outside of the SVG area
                            .attr("position", "relative")
                            .attr("transform", "translate(" + (0.5 * width) + "," + (0.5 * height) + ")scale(" + scalingFactor + ")")
                            .style("display", "block")
                            .style("margin", "auto")
                            .selectAll("text")
                            .data(words)
                            .enter().append("text")
                            .style("font-size", function (d) {
                                return d.size + "px";
                            })
                            .style("font-family", function (d) {
                                return d.font;
                            })
                            .style("fill", function (d, i) {
                                //if setDefaultColor in custom property is checked, I am deleting the old font color from properties
                                if (is10point3 && me.getProperty("defaultcolors") && me.getProperty("defaultcolors") === "true") {
                                    if (properties["textFont"] && properties["textFont"].fontColor)
                                        delete properties["textFont"].fontColor;
                                }

                                var index = indexMap[d.text];
                                //to use the thresholding color
                                if (is10point3 && rawD.children[index].values[0].threshold) {
                                    return rawD.children[index].values[0].threshold.fillColor;
                                }

                                //to use the single font color set by custom property
                                if (is10point3 && me.getProperty("textFont") && me.getProperty("textFont").fontColor) {
                                    return me.getProperty("textFont").fontColor;
                                }

                                //In case of 10.4 or above, will use the default color from ColorPallete API
                                if (is10point4 && me.zonesModel) {
                                    return me.getColorBy(rawD.children[index].colorInfo);
                                }

                                //In case of 10.3 or below, will use the default color from D3 color scale
                                return color(i);
                            })
                            .attr("transform", function (d) {
                                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                            })
                            .text(function (d) {
                                return d.text;
                            })
                            .on("click", function (d, i) {
                                var index = indexMap[d.text];
                                me.applySelection(rawD.children[index].attributeSelector);// Use the selector API when clicking on a bar
                            })
                            .on("mouseover", function (d) {
                                //to create tooltip

                                var rowtitle = me.dataInterface.getRowTitles().titles[0].n + ": ";
                                var colTitles = me.dataInterface.getColTitles().titles[0].es;
                                var index = indexMap[d.text];
                                var titletext = "";
                                for (var i = 0; i < colTitles.length; i++) {
                                    titletext += colTitles[i].n + ": " + rawD.children[index].values[i].v + "<br/>";
                                }

                                div.transition()
                                    .duration(200)
                                    .style("opacity", .9);
                                div.html(rowtitle + d.text + "<br/>" + titletext)
                                    .style("left", (d3.event.pageX - adjustTooltipX) + "px")
                                    .style("top", (d3.event.pageY - adjustTooltipY) + "px");
                            })
                            .on("mouseout", function (d) {
                                div.transition()
                                    .duration(500)
                                    .style("opacity", 0);
                            });

                    }
                    catch (e) {
                        me.displayError();
                    }
                }

                //heapsort - O(k + (n-k)log k) algorithm - Build MinHeap and track top maxvalue elements
                var size; // common var to store maxvalue for all heapsort functions

                function heapSort(values) {
                    size = maxvalue;
                    var reqdvalues = values.slice(0, maxvalue);

                    buildHeap(reqdvalues); //Build heap of size maxvalue

                    //If new elements are greater than the min element of heap, include it
                    for (var i = maxvalue; i < values.length; i++) {
                        if (values[i].value > reqdvalues[0].value) {
                            reqdvalues[0] = values[i];
                            minHeapify(reqdvalues, 0);
                        }
                    }

                    //sort the heap elements in descending order
                    for (var i = 0, j = size - 1; i < maxvalue; i++, j--) {
                        swap(reqdvalues, 0, j);
                        size--;
                        minHeapify(reqdvalues, 0);
                    }
                    return reqdvalues;
                }

                function buildHeap(reqdvalues) {
                    for (var i = Math.floor((maxvalue - 1) / 2); i >= 0; i--) {
                        minHeapify(reqdvalues, i);
                    }
                }

                function minHeapify(reqdvalues, i) {
                    var left = 2 * i + 1;
                    var right = 2 * i + 2;
                    var smallest = i;
                    if (left < size && reqdvalues[left].value < reqdvalues[smallest].value) {
                        smallest = left;
                    }
                    if (right < size && reqdvalues[right].value < reqdvalues[smallest].value) {
                        smallest = right;
                    }
                    if (smallest != i) {
                        swap(reqdvalues, smallest, i);
                        minHeapify(reqdvalues, smallest);
                    }
                }


                function swap(array, i, j) {
                    var temp = array[i];
                    array[i] = array[j];
                    array[j] = temp;
                }

            }
        })
}());
//@ sourceURL=D3WordCloud.js