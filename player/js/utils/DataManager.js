var dataManager = (function(){
    var frameRate = 0;
    var matrixInstance =  new MatrixManager();
    var storedBezierCurves = {};

    function completeTimeRemap(tm, layerFrames, offsetFrame){
        var interpolatedProperty = getInterpolatedValues(tm,layerFrames, offsetFrame);
        var i;
        var timeValues = [];
        for(i=0 ; i<layerFrames; i+=1){
            timeValues.push(Math.floor(interpolatedProperty[i]*frameRate));
        }
        return timeValues;
    }

    function completeLayers(layers){
        var layerFrames, offsetFrame;
        layers.forEach(function(layerData){
            layerFrames = layerData.outPoint - layerData.startTime;
            offsetFrame = layerData.startTime;
            layerData.layerName = convertLayerNameToID(layerData.layerName);
            if(layerData.parent){
                layerData.parent = convertLayerNameToID(layerData.parent);
            }
            layerData.renderedFrame = {};
            animArray = [];
            lastFrame = -1;
            if(layerData.tm){
                layerData.tm = completeTimeRemap(layerData.tm, layerFrames, offsetFrame);
            }
            if(layerData.type=='PreCompLayer'){
                completeLayers(layerData.layers);
            }
        })
    }

    function completeData(layers, fRate){
        frameRate = fRate;
        completeLayers(layers);
    }

    function convertLayerNameToID(string){
        string = string.replace(/ /g,"_");
        string = string.replace(/-/g,"_");
        string = string.replace(/\./g,"_");
        string = string.replace(/\//g,"_");
        return string;
    }

    function getInterpolatedValues(keyframes, frameCount, offsetTime){
        var i ,len;
        var valuesArray = [];
        if(!(keyframes instanceof Array) || keyframes[0].t == null){
            valuesArray.push(keyframes);
            return valuesArray;
        }
        var keyData, nextKeyData;
        valuesArray = [];
        var count;
        var propertyArray = [];
        var j, jLen;
        len = keyframes.length;
        var perc;
        var curveSegments = 1000;
        var absToCoord = [];
        var absTiCoord = [];
        keyframes.forEach(function(keyData){
            keyData.t -= offsetTime;
            if(keyData.to){
                var k;
                var triCoord1,triCoord2,triCoord3,liCoord1,liCoord2,ptCoord,perc,addedLength = 0;
                var ptDistance;
                var point,lastPoint = null;
                var bezierData = {
                    points :[],
                    length: 0
                };
                for(k=0;k<curveSegments;k+=1){
                    point = [];
                    perc = k/(curveSegments-1);
                    ptDistance = 0;
                    absToCoord = [];
                    absTiCoord = [];
                    keyData.to.forEach(function(item,index){
                        if(absToCoord[index] == null){
                            absToCoord[index] = keyData.s[index] + keyData.to[index];
                            absTiCoord[index] = keyData.e[index] + keyData.ti[index];
                        }
                        triCoord1 = keyData.s[index] + (absToCoord[index] - keyData.s[index])*perc;
                        triCoord2 = absToCoord[index] + (absTiCoord[index] - absToCoord[index])*perc;
                        triCoord3 = absTiCoord[index] + (keyData.e[index] - absTiCoord[index])*perc;
                        liCoord1 = triCoord1 + (triCoord2 - triCoord1)*perc;
                        liCoord2 = triCoord2 + (triCoord3 - triCoord2)*perc;
                        ptCoord = liCoord1 + (liCoord2 - liCoord1)*perc;
                        point.push(ptCoord);
                        if(lastPoint !== null){
                            ptDistance += Math.pow(point[index] - lastPoint[index],2);
                        }
                    });
                    ptDistance = Math.sqrt(ptDistance);
                    addedLength += ptDistance;
                    bezierData.points.push({partialLength: addedLength, point: point});
                    lastPoint = point;
                    keyData.bezierData = bezierData;
                }
                bezierData.segmentLength = addedLength;
            }
        });
        var lastFrameIndex = 0;
        var lastPointIndex = 0;
        for(i=0;i<frameCount;i+=1){
            count = lastFrameIndex;
            var found = false;
            while(count<len-1){
                keyData = keyframes[count];
                nextKeyData = keyframes[count+1];
                if(i<keyData.t && count == 0){
                    jLen = keyData.s.length;
                    propertyArray = [];
                    for(j=0;j<jLen;j+=1){
                        propertyArray.push(keyData.s[j]);
                    }
                    valuesArray.push(propertyArray);
                    found = true;
                    if(lastFrameIndex != count){
                        lastFrameIndex = count;
                        lastPointIndex = 0;
                    }
                    break;
                }else if(i>=keyData.t && i<nextKeyData.t){
                    propertyArray = [];
                    if(keyData.to){
                        perc = bez.getCurve([keyData.o.x,keyData.o.y,keyData.i.x,keyData.i.y])('',i-keyData.t,0,1,nextKeyData.t-keyData.t);
                        var bezierData = keyData.bezierData;
                        var distanceInLine = bezierData.segmentLength*perc;
                        var k, kLen, segmentPerc;
                        j = lastPointIndex;
                        while(j<bezierData.points.length){
                            if(i == 0 || distanceInLine == 0 || perc == 0){
                                propertyArray = bezierData.points[j].point;
                                lastPointIndex = j;
                                break;
                            }else if(j == bezierData.points.length - 1){
                                propertyArray = bezierData.points[j].point;
                            }else if(distanceInLine > bezierData.points[j].partialLength && distanceInLine < bezierData.points[j+1].partialLength){
                                kLen = bezierData.points[j].point.length;
                                segmentPerc = (distanceInLine-bezierData.points[j].partialLength)/(bezierData.points[j+1].partialLength-bezierData.points[j].partialLength);
                                for(k=0;k<kLen;k+=1){
                                    propertyArray.push(bezierData.points[j].point[k] + (bezierData.points[j+1].point[k] - bezierData.points[j].point[k])*segmentPerc);
                                }
                                //propertyArray = bezierData.points[j].point;
                                lastPointIndex = j;
                                break;
                            }
                            j += 1;
                        }
                    }else{
                        var outX,outY,inX,inY;
                        keyData.s.forEach(function(startItem,index){
                            if(keyData.h !== 1){
                                if(keyData.o.x instanceof Array){
                                    outX = keyData.o.x[index];
                                    outY = keyData.o.y[index];
                                    inX = keyData.i.x[index];
                                    inY = keyData.i.y[index];
                                }else{
                                    outX = keyData.o.x;
                                    outY = keyData.o.y;
                                    inX = keyData.i.x;
                                    inY = keyData.i.y;
                                }
                                perc = bez.getCurve([outX,outY,inX,inY])('',i-keyData.t,0,1,nextKeyData.t-keyData.t);
                            }
                            // for shapes
                            if(startItem.i){
                                var shapeData = {
                                    i: [],
                                    o: [],
                                    v: []
                                };
                                startItem.i.forEach(function(inItem,inIndex){
                                    var coordsIData = [];
                                    var coordsOData = [];
                                    var coordsVData = [];
                                    inItem.forEach(function(pointItem,pointIndex){
                                        if(keyData.h === 1){
                                            coordsIData.push(pointItem);
                                            coordsOData.push(startItem.o[inIndex][pointIndex]);
                                            coordsVData.push(startItem.v[inIndex][pointIndex]);
                                        }else{
                                            coordsIData.push(pointItem+(keyData.e[index].i[inIndex][pointIndex]-pointItem)*perc);
                                            coordsOData.push(startItem.o[inIndex][pointIndex]+(keyData.e[index].o[inIndex][pointIndex]-startItem.o[inIndex][pointIndex])*perc);
                                            coordsVData.push(startItem.v[inIndex][pointIndex]+(keyData.e[index].v[inIndex][pointIndex]-startItem.v[inIndex][pointIndex])*perc);
                                        }
                                    });
                                    shapeData.i.push(coordsIData);
                                    shapeData.o.push(coordsOData);
                                    shapeData.v.push(coordsVData);
                                });
                                propertyArray.push(shapeData);
                            }else{
                                //perc = (i-keyData.t)/(nextKeyData.t-keyData.t);
                                if(keyData.h === 1){
                                    propertyArray.push(startItem);
                                }else{
                                    propertyArray.push(startItem+(keyData.e[index]-startItem)*perc);
                                }
                            }
                        });
                    }
                    valuesArray.push(propertyArray);
                    found = true;
                    if(lastFrameIndex != count){
                        lastFrameIndex = count;
                        lastPointIndex = 0;
                    }
                    break;
                }
                count += 1;
            }
            if(found == false){
                keyData = keyframes[keyframes.length - 2];
                propertyArray = [];
                keyData.e.forEach(function(item){
                    propertyArray.push(item);
                });
                valuesArray.push(propertyArray);
            }
        }
        count = valuesArray.length;
        while(count < frameCount){
            valuesArray.push(propertyArray);
            count += 1;
        }
        return valuesArray;
    }

    function drawBezierCurve(coOrdArray){
        var bezierName = coOrdArray.join('_').replace(/\./g, 'p');
        if(storedBezierCurves[bezierName]){

            return storedBezierCurves[bezierName];
        }
        var curveSegments = 1000, absToCoord, absTiCoord;
        var k;
        var triCoord1,triCoord2,triCoord3,liCoord1,liCoord2,ptCoord,perc,addedLength = 0;
        var ptDistance;
        var point,lastPoint = null;
        var bezierData = {
            points :[],
            segmentLength: 0
        };
        if(pointOnLine2D(coOrdArray[0][0],coOrdArray[0][1],coOrdArray[1][0],coOrdArray[1][1],coOrdArray[0][0]+coOrdArray[2][0],coOrdArray[0][1]+coOrdArray[2][1])
            && pointOnLine2D(coOrdArray[0][0],coOrdArray[0][1],coOrdArray[1][0],coOrdArray[1][1],coOrdArray[1][0]+coOrdArray[3][0],coOrdArray[1][1]+coOrdArray[3][1])){
            curveSegments = 2;
        }
        for(k=0;k<curveSegments;k+=1){
            point = [];
            perc = k/(curveSegments-1);
            ptDistance = 0;
            absToCoord = [];
            absTiCoord = [];
            coOrdArray[2].forEach(function(item,index){
                if(absToCoord[index] == null){
                    absToCoord[index] = coOrdArray[0][index] + item;
                    absTiCoord[index] = coOrdArray[1][index] + coOrdArray[3][index];
                }
                triCoord1 = coOrdArray[0][index] + (absToCoord[index] - coOrdArray[0][index])*perc;
                triCoord2 = absToCoord[index] + (absTiCoord[index] - absToCoord[index])*perc;
                triCoord3 = absTiCoord[index] + (coOrdArray[1][index] - absTiCoord[index])*perc;
                liCoord1 = triCoord1 + (triCoord2 - triCoord1)*perc;
                liCoord2 = triCoord2 + (triCoord3 - triCoord2)*perc;
                ptCoord = liCoord1 + (liCoord2 - liCoord1)*perc;
                point.push(ptCoord);
                if(lastPoint !== null){
                    ptDistance += Math.pow(point[index] - lastPoint[index],2);
                }
            });
            ptDistance = Math.sqrt(ptDistance);
            addedLength += ptDistance;
            bezierData.points.push({partialLength: ptDistance, point: point});
            lastPoint = point;
        }
        bezierData.segmentLength = addedLength;
        storedBezierCurves[bezierName] = bezierData;
        return bezierData;
    }

    function pointOnLine2D(x1,y1, x2,y2, x3,y3){
        return Math.abs(((x2 - x1) * (y3 - y1)) - ((x3 - x1) * (y2 - y1))) < 0.0000001;
    }

    function buildBezierData(keyData){
        var curveSegments = 1000, absToCoord, absTiCoord;
        var k;
        var triCoord1,triCoord2,triCoord3,liCoord1,liCoord2,ptCoord,perc,addedLength = 0;
        var ptDistance;
        var point,lastPoint = null;
        var bezierData = {
            points :[],
            segmentLength: 0
        };
        if(pointOnLine2D(keyData.s[0],keyData.s[1],keyData.e[0],keyData.e[1],keyData.s[0]+keyData.to[0],keyData.s[1]+keyData.to[1])
            && pointOnLine2D(keyData.s[0],keyData.s[1],keyData.e[0],keyData.e[1],keyData.e[0]+keyData.ti[0],keyData.e[1]+keyData.ti[1])){
            curveSegments = 2;
        }
        for(k=0;k<curveSegments;k+=1){
            point = [];
            perc = k/(curveSegments-1);
            ptDistance = 0;
            absToCoord = [];
            absTiCoord = [];
            keyData.to.forEach(function(item,index){
                if(absToCoord[index] == null){
                    absToCoord[index] = keyData.s[index] + item;
                    absTiCoord[index] = keyData.e[index] + keyData.ti[index];
                }
                triCoord1 = keyData.s[index] + (absToCoord[index] - keyData.s[index])*perc;
                triCoord2 = absToCoord[index] + (absTiCoord[index] - absToCoord[index])*perc;
                triCoord3 = absTiCoord[index] + (keyData.e[index] - absTiCoord[index])*perc;
                liCoord1 = triCoord1 + (triCoord2 - triCoord1)*perc;
                liCoord2 = triCoord2 + (triCoord3 - triCoord2)*perc;
                ptCoord = liCoord1 + (liCoord2 - liCoord1)*perc;
                point.push(ptCoord);
                if(lastPoint !== null){
                    ptDistance += Math.pow(point[index] - lastPoint[index],2);
                }
            });
            ptDistance = Math.sqrt(ptDistance);
            addedLength += ptDistance;
            bezierData.points.push({partialLength: addedLength, point: point});
            lastPoint = point;
        }
        keyData.bezierData = bezierData;
        bezierData.segmentLength = addedLength;
    }

    var keyData, nextKeyData,propertyArray,bezierData;

    function getInterpolatedValue(keyframes, frameNum, offsetTime){

        //Todo save on each frame the point found. pass to this function the previous frame to iterate points from last point.

        if(!(keyframes instanceof Array) || keyframes[0].t == null){
            return keyframes;
        }
        var i = 0, len = keyframes.length-1;
        while(i<len){
            keyData = keyframes[i];
            nextKeyData = keyframes[i+1];
            if((nextKeyData.t - offsetTime) > frameNum){
                break;
            }
            i += 1;
        }

        if(keyData.to && !keyData.bezierData){
            buildBezierData(keyData);
        }
        var k, kLen;
        var easingFnName, perc, j = 0;
        propertyArray = [];
        if(keyData.to){
            bezierData = keyData.bezierData;
            if(frameNum >= nextKeyData.t-offsetTime){
                return bezierData.points[bezierData.points.length - 1].point;
            }else if(frameNum < keyData.t-offsetTime){
                return bezierData.points[0].point;
            }
            perc = bez.getCurve([keyData.o.x,keyData.o.y,keyData.i.x,keyData.i.y])('',(frameNum)-(keyData.t-offsetTime),0,1,(nextKeyData.t-offsetTime)-(keyData.t-offsetTime));
            var distanceInLine = bezierData.segmentLength*perc;
            var segmentPerc;
            while(j<bezierData.points.length){
                if(frameNum == 0 || distanceInLine == 0 || perc == 0){
                    propertyArray = bezierData.points[j].point;
                    break;
                }else if(j == bezierData.points.length - 1){
                    propertyArray = bezierData.points[j].point;
                }else if(distanceInLine > bezierData.points[j].partialLength && distanceInLine < bezierData.points[j+1].partialLength){
                    kLen = bezierData.points[j].point.length;
                    segmentPerc = (distanceInLine-bezierData.points[j].partialLength)/(bezierData.points[j+1].partialLength-bezierData.points[j].partialLength);
                    for(k=0;k<kLen;k+=1){
                        propertyArray.push(bezierData.points[j].point[k] + (bezierData.points[j+1].point[k] - bezierData.points[j].point[k])*segmentPerc);
                    }
                    //propertyArray = bezierData.points[j].point;
                    break;
                }
                j += 1;
            }
        }else{
            var outX,outY,inX,inY;
            len = keyData.s.length;
            for(i=0;i<len;i+=1){
                if(keyData.h !== 1){
                    if(keyData.o.x instanceof Array){
                        outX = keyData.o.x[i];
                        outY = keyData.o.y[i];
                        inX = keyData.i.x[i];
                        inY = keyData.i.y[i];
                    }else{
                        outX = keyData.o.x;
                        outY = keyData.o.y;
                        inX = keyData.i.x;
                        inY = keyData.i.y;
                    }
                    perc = bez.getCurve([outX,outY,inX,inY])('',(frameNum)-(keyData.t-offsetTime),0,1,(nextKeyData.t-offsetTime)-(keyData.t-offsetTime));
                    if(frameNum >= nextKeyData.t-offsetTime){
                        perc = 1;
                    }else if(frameNum < keyData.t-offsetTime){
                        perc = 0;
                    }
                }
                if(keyData.s[i].i){
                    var shapeData = {
                        i: [],
                        o: [],
                        v: []
                    };
                    var jLen = keyData.s[i].i.length;
                    for(j=0;j<jLen;j+=1){
                        var coordsIData = [];
                        var coordsOData = [];
                        var coordsVData = [];
                        kLen = keyData.s[i].i[j].length;
                        for(k=0;k<kLen;k+=1){
                            if(keyData.h === 1){
                                coordsIData.push(keyData.s[i].i[j][k]);
                                coordsOData.push(keyData.s[i].o[j][k]);
                                coordsVData.push(keyData.s[i].v[j][k]);
                            }else{
                                coordsIData.push(keyData.s[i].i[j][k]+(keyData.e[i].i[j][k]-keyData.s[i].i[j][k])*perc);
                                coordsOData.push(keyData.s[i].o[j][k]+(keyData.e[i].o[j][k]-keyData.s[i].o[j][k])*perc);
                                coordsVData.push(keyData.s[i].v[j][k]+(keyData.e[i].v[j][k]-keyData.s[i].v[j][k])*perc);
                            }
                        }
                        shapeData.i.push(coordsIData);
                        shapeData.o.push(coordsOData);
                        shapeData.v.push(coordsVData);
                    }
                    propertyArray.push(shapeData);
                }else{
                    //perc = (i-keyData.t)/(nextKeyData.t-keyData.t);
                    if(keyData.h === 1){
                        propertyArray.push(keyData.s[i]);
                    }else{
                        propertyArray.push(keyData.s[i]+(keyData.e[i]-keyData.s[i])*perc);
                    }
                }
            }
        }
        return propertyArray;
    }

    var pathV,pathO,pathI;
    var pathString = '';
    var pathData;

    function createPathString(paths,closed){
        if(!(paths instanceof Array)){
            paths = [paths];
        }
        var l,lLen = paths.length;
        var k, kLen;
        pathString = '';
        for(l = 0;l<lLen;l+=1){
            pathData = paths[l];
            pathV = pathData.v;
            pathO = pathData.o;
            pathI = pathData.i;
            kLen = pathV.length;
            pathString += "M"+pathV[0][0]+","+pathV[0][1];
            for(k=1;k<kLen;k++){
                pathString += " C"+(pathO[k-1][0]+pathV[k-1][0])+","+(pathO[k-1][1]+pathV[k-1][1]) + " "+(pathI[k][0]+pathV[k][0])+","+(pathI[k][1]+pathV[k][1]) + " "+pathV[k][0]+","+pathV[k][1];
            }
            if(closed !== false){
                pathString += " C"+(pathO[k-1][0]+pathV[k-1][0])+","+(pathO[k-1][1]+pathV[k-1][1]) + " "+(pathI[0][0]+pathV[0][0])+","+(pathI[0][1]+pathV[0][1]) + " "+pathV[0][0]+","+(pathV[0][1]);
            }
        }
        return pathString;
    }

    var trOb, dataOb, opacity,pos,rot,scale;
    var maskProps,maskValue;
    var timeRemapped;
    var shapeItem;
    var fillOpacity,fillColor, shape, strokeColor, strokeOpacity, strokeWidth, elmPos, elmSize, elmRound;
    var shapeTrOb = {};

    function iterateLayers(layers, frameNum,renderType){

        var offsettedFrameNum, i, len;
        var j, jLen = layers.length, item;
        for(j=0;j<jLen;j+=1){
            item = layers[j];
            offsettedFrameNum = frameNum - item.startTime;
            if(frameNum < item.inPoint || frameNum > item.outPoint){
                continue;
            }
            if(item.an[offsettedFrameNum]){
                continue;
            }
            trOb = {};
            dataOb = {};
            dataOb.a = getInterpolatedValue(item.ks.a,offsettedFrameNum, item.startTime);
            opacity = getInterpolatedValue(item.ks.o,offsettedFrameNum, item.startTime);
            dataOb.o = opacity instanceof Array ? opacity[0]/100 : opacity/100;
            pos = getInterpolatedValue(item.ks.p,offsettedFrameNum, item.startTime);
            rot = getInterpolatedValue(item.ks.r,offsettedFrameNum, item.startTime);
            scale = getInterpolatedValue(item.ks.s,offsettedFrameNum, item.startTime);
            trOb.s = scale instanceof Array ? scale.length > 1 ? [scale[0]/100,scale[1]/100,scale[2]/100] : [scale[0]/100,scale[0]/100,scale[0]/100] : [scale/100,scale/100,scale/100];
            trOb.r = rot instanceof Array ? rot.length > 1 ? [rot[0]*Math.PI/180,rot[1]*Math.PI/180,rot[2]*Math.PI/180] : [rot[0]*Math.PI/180,rot[0]*Math.PI/180,rot[0]*Math.PI/180] : [0,0,rot*Math.PI/180];
            trOb.p = pos;
            if(subframeEnabled){
                item.an = [];
            }
            item.an[offsettedFrameNum] = {
                forwardFrame : offsettedFrameNum,
                tr: dataOb,
                matrixValue: matrixInstance.getMatrix2(trOb),
                matrixArray: matrixInstance.getMatrixArray(trOb)
            };
            if(item.hasMask){
                maskProps = item.masksProperties;
                len = maskProps.length;
                for(i=0;i<len;i+=1){
                    if(!maskProps[i].pathStrings || subframeEnabled){
                        maskProps[i].pathStrings = [];
                        maskProps[i].pathVertices = [];
                        maskProps[i].opacity = [];
                    }
                    maskValue = getInterpolatedValue(maskProps[i].pt,offsettedFrameNum, item.startTime);
                    maskProps[i].pathVertices[offsettedFrameNum] = maskValue instanceof Array ? maskValue : [maskValue];
                    if(renderType == 'svg'){
                        maskProps[i].pathStrings[offsettedFrameNum] = createPathString(maskValue,maskProps[i].cl);
                    }
                    maskProps[i].opacity[offsettedFrameNum] = getInterpolatedValue(maskProps[i].o,offsettedFrameNum, item.startTime);
                    maskProps[i].opacity[offsettedFrameNum] = maskProps[i].opacity[offsettedFrameNum] instanceof Array ? maskProps[i].opacity[offsettedFrameNum][0]/100 : maskProps[i].opacity[offsettedFrameNum]/100;
                }
            }
            if(item.type == 'PreCompLayer'){
                timeRemapped = item.tm ? item.tm[offsettedFrameNum] < 0 ? 0 : item.tm[offsettedFrameNum] : offsettedFrameNum;
                iterateLayers(item.layers,timeRemapped);
            }else if(item.type == 'ShapeLayer'){
                len = item.shapes.length;
                for(i=0;i<len;i+=1){
                    shapeItem = item.shapes[i];
                    if(!shapeItem._created || subframeEnabled){
                        shapeItem.an.tr = [];
                        shapeItem.an.renderedFrame = {};
                        if(shapeItem.ks){
                            shapeItem.an.path = [];
                        }else if(shapeItem.el){
                            shapeItem.an.ell = [];
                        }else if(shapeItem.rc){
                            shapeItem.an.rect = [];
                        }
                        if(shapeItem.fl){
                            shapeItem.an.fill = [];
                        }
                        if(shapeItem.st){
                            shapeItem.an.stroke = [];
                        }
                    }
                    if(shapeItem.trim && (!shapeItem._created  || subframeEnabled)){
                        shapeItem.trim.an = [];
                    }
                    if(shapeItem.fl){
                        fillColor = getInterpolatedValue(shapeItem.fl.c,offsettedFrameNum, item.startTime);
                        fillOpacity = getInterpolatedValue(shapeItem.fl.o,offsettedFrameNum, item.startTime);
                        shapeItem.an.fill[offsettedFrameNum] = {
                            color : rgbToHex(Math.round(fillColor[0]),Math.round(fillColor[1]),Math.round(fillColor[2])),
                            opacity : fillOpacity instanceof Array ? fillOpacity[0]/100 : fillOpacity/100,
                            forwardFrame : offsettedFrameNum
                        };
                    }
                    if(shapeItem.ks){
                        shape = getInterpolatedValue(shapeItem.ks,offsettedFrameNum, item.startTime);
                        shapeItem.an.path[offsettedFrameNum] = {
                            pathNodes: shape,
                            closed: shapeItem.closed,
                            forwardFrame : offsettedFrameNum
                        };
                        if(renderType == 'svg'){
                            shapeItem.an.path[offsettedFrameNum].pathString = createPathString(shape,shapeItem.closed);
                        }
                    }else if(shapeItem.el){
                        elmPos = getInterpolatedValue(shapeItem.el.p,offsettedFrameNum, item.startTime);
                        elmSize = getInterpolatedValue(shapeItem.el.s,offsettedFrameNum, item.startTime);
                        shapeItem.an.ell[offsettedFrameNum] = {
                            p : elmPos,
                            size : elmSize,
                            forwardFrame : offsettedFrameNum
                        };
                    }else if(shapeItem.rc){
                        elmPos = getInterpolatedValue(shapeItem.rc.p,offsettedFrameNum, item.startTime);
                        elmSize = getInterpolatedValue(shapeItem.rc.s,offsettedFrameNum, item.startTime);
                        elmRound = getInterpolatedValue(shapeItem.rc.r,offsettedFrameNum, item.startTime);
                        shapeItem.an.rect[offsettedFrameNum] = {
                            position : elmPos,
                            size : elmSize,
                            roundness : elmRound,
                            forwardFrame : offsettedFrameNum
                        };
                    }
                    if(shapeItem.st){
                        strokeColor = getInterpolatedValue(shapeItem.st.c,offsettedFrameNum, item.startTime);
                        strokeOpacity = getInterpolatedValue(shapeItem.st.o,offsettedFrameNum, item.startTime);
                        strokeWidth = getInterpolatedValue(shapeItem.st.w,offsettedFrameNum, item.startTime);
                        shapeItem.an.stroke[offsettedFrameNum] = {
                            color : rgbToHex(Math.round(strokeColor[0]),Math.round(strokeColor[1]),Math.round(strokeColor[2])),
                            opacity : strokeOpacity instanceof Array ? strokeOpacity[0]/100 : strokeOpacity/100,
                            width : strokeWidth instanceof Array ? strokeWidth[0] : strokeWidth,
                            forwardFrame : offsettedFrameNum
                        };
                    }
                    shapeTrOb = {};
                    //var shapeDataOb = {};
                    shapeTrOb.a = getInterpolatedValue(shapeItem.tr.a,offsettedFrameNum, item.startTime);
                    shapeTrOb.o = getInterpolatedValue(shapeItem.tr.o,offsettedFrameNum, item.startTime);
                    shapeTrOb.o = shapeTrOb.o instanceof Array ? shapeTrOb.o[0]/100 : shapeTrOb.o/100;
                    shapeTrOb.s = getInterpolatedValue(shapeItem.tr.s,offsettedFrameNum, item.startTime);
                    shapeTrOb.s = shapeTrOb.s instanceof Array ? shapeTrOb.s.length > 1 ? [shapeTrOb.s[0]/100,shapeTrOb.s[1]/100,shapeTrOb.s[2]/100] : [shapeTrOb.s[0]/100,shapeTrOb.s[0]/100,shapeTrOb.s[0]/100] : [shapeTrOb.s/100,shapeTrOb.s/100,shapeTrOb.s/100];
                    shapeTrOb.r = getInterpolatedValue(shapeItem.tr.r,offsettedFrameNum, item.startTime);
                    shapeTrOb.r = shapeTrOb.r instanceof Array ? shapeTrOb.r.length > 1 ? [shapeTrOb.r[0]*Math.PI/180,shapeTrOb.r[1]*Math.PI/180,shapeTrOb.r[2]*Math.PI/180] : [shapeTrOb.r[0]*Math.PI/180,shapeTrOb.r[0]*Math.PI/180,shapeTrOb.r[0]*Math.PI/180] : [0,0,shapeTrOb.r*Math.PI/180];
                    shapeTrOb.p = getInterpolatedValue(shapeItem.tr.p,offsettedFrameNum, item.startTime);
                    shapeTrOb.mt = matrixInstance.getMatrix2(shapeTrOb);
                    shapeTrOb.mtArr = matrixInstance.getMatrixArray(shapeTrOb);
                    shapeTrOb.forwardFrame = offsettedFrameNum;
                    shapeItem.an.tr[offsettedFrameNum] = shapeTrOb;

                    if(shapeItem.trim){
                        var trimS = getInterpolatedValue(shapeItem.trim.s,offsettedFrameNum, item.startTime);
                        var trimE = getInterpolatedValue(shapeItem.trim.e,offsettedFrameNum, item.startTime);
                        var trimO = getInterpolatedValue(shapeItem.trim.o,offsettedFrameNum, item.startTime);
                        shapeItem.trim.an[offsettedFrameNum] = {
                            s: trimS,
                            e: trimE,
                            o: trimO,
                            forwardFrame: offsettedFrameNum
                        }
                    }
                    if(!shapeItem._created){
                        shapeItem._created = true;
                    }
                }
            }
        }
    }

    function renderFrame(layers,num, renderType){
        iterateLayers(layers, num, renderType);
    }

    var moduleOb = {};
    moduleOb.completeData = completeData;
    moduleOb.renderFrame = renderFrame;
    moduleOb.drawBezierCurve = drawBezierCurve;

    return moduleOb;
}());