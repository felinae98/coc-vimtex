const {sources, workspace, SourceType} = require('coc.nvim')
const {convertRegex, byteSlice} = require('./util')

async function activate(context) {
  let config = workspace.getConfiguration('coc.source.vimtex')
  let {nvim} = workspace

  let regex
  try {
    regex = await nvim.eval('vimtex#re#deoplete')
  } catch (e) {
    workspace.showMessage('vimtex not loaded, please check your runtimepath', 'error')
    return
  }
  let pattern = new RegExp(convertRegex(regex) + '$')

  function convertItems(list) {
    let res = []
    for (let item of list) {
      if (typeof item == 'string') {
        res.push(Object.assign({word: item}))
      }
      if (item.hasOwnProperty('word')) {
        res.push(item)
      }
    }
    return res
  }

  let source = {
    name: 'vimtex',
    enable: config.get('enable', true),
    priority: config.get('priority', 99),
    filetypes: config.get('filetypes', ['tex', 'latex', 'plaintex']),
    sourceType: SourceType.Remote,
    triggerPatterns: [pattern],
    doComplete: async opt => {
      let {nvim} = workspace
      let func = 'vimtex#complete#omnifunc'
      let {line, colnr, col} = opt
      let startcol = col
      try {
        startcol = await nvim.call(func, [1, ''])
        startcol = Number(startcol)
      } catch (e) {
        workspace.showMessage(`vim error from ${func} :${e.message}`, 'error')
        return null
      }
      // invalid startcol
      if (isNaN(startcol) || startcol < 0 || startcol > colnr) return null
      let text = byteSlice(line, startcol, colnr - 1)
      let words = await nvim.call(func, [0, text])
      if (words.hasOwnProperty('words')) {
        words = words.words
      }
      let res = {items: convertItems(words)}
      res.startcol = startcol
      return res
    }
  }

  sources.addSource(source)
  context.subscriptions.push({
    dispose: () => {
      sources.removeSource(source)
    }
  })
}

exports.activate = async context => {
  let config = workspace.getConfiguration('coc.source.vimtex')
  let filetypes = config.get('filetypes', ['tex', 'latex', 'plaintex'])
  let activated = false
  let active = () => {
    if (activated) return
    activated = true
    activate(context)
  }
  for (let doc of workspace.documents) {
    if (filetypes.includes(doc.textDocument.languageId)) {
      active()
    }
  }
  if (!activated) {
    workspace.onDidOpenTextDocument(e => {
      if (filetypes.includes(e.languageId)) {
        active()
      }
    }, null, context.subscriptions)
  }
}
