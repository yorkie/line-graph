
var Canvas = require('canvas-browserify')
var getStats = require('./stats')
var pull = require('pull-stream')
var Vec2 = require('vec2')
var vecCanvas = require('./vec2-canvas')

function v (x, y) {
  return new Vec2(x, y)
}

function find (ary, test) {
  for(var i in ary)
    if(test(ary[i], i, ary))
      return ary[i]
}

/*
now, we can only support 2 scales, maximum.
(to be drawn on the left and the right side)
*/

//hmm, would a regular expression dsl be easier to read?
//rx(/([\w\s/]+)/).whitespace().maybe(/<([^>])>/).toRegExp()

function parseUnits (header) {
  var m = /([\w\s]+)\s+\(([^\)]+)\)/.exec(header)
  if(!m) return {name: header}
  return {name: m[1], units: m[2]}
}

var graph = module.exports = function (table, opts) {
  opts = opts || {}
  var canvas = Canvas()
  canvas.width = opts.width || 300
  canvas.height = opts.height || 150
  var ctx = canvas.getContext('2d')

  //uh, actually, I don't need this yet,
  //because I only have 3 columns.
//  var headers = table.shift().map(parseUnits)

  table.sort(function (a, b) {
    return a[0] - b[0]
  })

  //this will be synchronous, because table is an array.

  var stats = getStats(table.map(function (e) {
      if(isNaN(e[0])) return e
      e[0] = Math.log(e[0])
      return e
    }))
//  pull(
//    pull.values(table),
//    pull.map(),
//    getStats(function (err, _stats) {
//      if(err) throw err
//      stats = _stats
//  }))
//  
  //calculate margin from font height

  var textHeight = parseInt(CTX.font)
  var margin = textHeight * 3

  stats.forEach(function (stat, i) {
    if(!stat || !i) return
    stat.min = 0
    stat.range = stat.max
  })

  var stat = stats[0]
  var xScale = (canvas.width - margin*2) / (stat.max - stat.min)
  var xMin = stat.min

  var colours = ['black', 'red', 'blue', 'green', 'yellow']

  function round (n) {
    return parseFloat(n.toPrecision(3))
  }

  var draw =
    vecCanvas(ctx)

  var j = 0

  //draw scale on the sides of the graph
  function drawScale (stat, min, max, align, log) {
    draw.strokeStyle('black').fillStyle('black').start().move(min).line(max)
    
    function toLog (value) {
      return log ? Math.pow(Math.E, value) : value
    }

    var textWidth = ctx.measureText(round(toLog(stat.max))).width
    var textSize = align.x ? textHeight : textWidth
    //how many marks can fit on the graph?

    var room   = v(max).subtract(min).length()
    var vec    = v(max).subtract(min).normalize()
    var offset = v(align).multiply((align.x > 0 ? textHeight : textHeight*1.5))
    var dash   = v(align).multiply(5)

    var ranges = [1, 2, 5, 10, 20, 50, 100, 200, 500,
                  1000, 2000, 5000, 1e4, 2e4, 5e4,
                  1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7]

    var xScale = room/(stat.max - stat.min)
    //figure out step size for linear axis
    var _step = !log ? find(ranges, function (e) {
      return room / (stat.range / e) > textSize*3 ? e : null
    }) : 1

    function step (i) {
      return !log ? _step * i 
      : (Math.log(Math.pow(Math.E, round(stat.min)) * Math.pow(Math.pow(10, 1), i)) - stat.min)
    }

    var marks = Math.floor(stat.range/_step)

    var markV = v(), textV = v()
    for(var i = 0; i <= marks; i++) {
      var value = step(i)
      markV.set(vec).multiply(value*xScale).add(min)

      draw
        .textAlign('center')
        .text(
          round(toLog(stat.min + value)),
          textV.set(markV).add(offset),
          {rotate: !!align.x} //90 degrees
        )
        .move(markV)
        .line(markV.add(dash))
    }

    if(stat.title)
      draw.fillStyle(colours[j++]).text(
        stat.title,
        min.add(max).divide(2).add(align.multiply((align.x > 0 ? textHeight*2 : textHeight*2.5))),
        {rotate: !!align.x}
      )
    draw.stroke()
  }
 
  drawScale(
    stats[0],
    v(margin, canvas.height - margin),
    v(canvas.width - margin, canvas.height - margin),
    v(0, 1),
    true
  )

  drawScale(
    stats[1],
    v(margin, canvas.height - margin),
    v(margin, margin),
    v(-1, 0)
  )

  drawScale(
    stats[2],
    v(canvas.width - margin, canvas.height - margin),
    v(canvas.width - margin, margin),
    v(1, 0)
  )

  draw.fillStyle('black').text('Time to Construct Merkle Tree', {x: canvas.width/2, y: textHeight * 2})

  stats.forEach(function (header, col) {
    if(!col) return
    var stat = stats[col]
    if(!stat) return
    var yScale = (canvas.height - margin*2)/(stat.max - stat.min)
    var _x = 0, _y = 0
    ctx.strokeStyle = colours[col]
    //'#'+ (Math.random().toString().substring(2, 8))
    ctx.beginPath()
    table.forEach(function (row, n) {
      var value = row[col]
      if(isNaN(value)) return
      var y = margin + (value - stat.min)*yScale
      var x = margin + (row[0] - xMin)*xScale
      ;(n ? ctx.lineTo : ctx.moveTo).call(ctx, x, canvas.height - y)
    })
    ctx.stroke()
  })
  
  return canvas
}

if(process.title === 'browser') {
  document.body.appendChild(
    graph(require('./test.json'), {width: 1000, height:600}))
} else if(!module.parent) {
  var parseCSV = require('./parse-csv')
  pull(
    require('stream-to-pull-stream').read(process.stdin),
    parseCSV(),
    pull.collect(function (err, table) {
      graph(table)//.pngStream().pipe(process.stdout)
    })
  )
}


