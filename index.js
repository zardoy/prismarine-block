//@ts-check
module.exports = loader
module.exports.testedVersions = ['1.8.8', '1.9.4', '1.10.2', '1.11.2', '1.12.2', '1.13.2', '1.14.4', '1.15.2', '1.16.4', '1.17.1', '1.18.1', 'bedrock_1.17.10', 'bedrock_1.18.0', '1.20']

const nbt = require('prismarine-nbt')
const mcData = require('minecraft-data')
const legacyPcBlocksByName = Object.entries(mcData.legacy.pc.blocks).reduce((obj, [idmeta, name]) => {
  const n = name.replace('minecraft:', '').split('[')[0]
  const s = name.split('[')[1]?.replace(']', '') ?? ''
  ;(obj[n] = obj[n] || {})[s] = idmeta
  return obj // array of { [name]: { [states string]: string(id:meta) } }
}, {})
const legacyPcBlocksByIdmeta = Object.entries(mcData.legacy.pc.blocks).reduce((obj, [idmeta, name]) => {
  const s = name.split('[')[1]?.replace(']', '')
  obj[idmeta] = s
    ? Object.fromEntries(s.split(',').map(s => {
      let [k, v] = s.split('=')
      if (!isNaN(parseInt(v))) v = parseInt(v)
      return [k, v]
    }))
    : {}
  return obj // array of { '255:0': { mode: 'save' }, }
}, {})

function parseProperties (properties) {
  if (typeof properties === 'object') { return properties }

  const json = {}
  for (const prop of properties.split(',')) {
    const [key, value] = prop.split('=')
    json[key] = value
  }
  return json
}

function matchProperties (block, /* to match against */properties) {
  if (!properties) { return true }

  properties = parseProperties(properties)
  const blockProps = block.getProperties()
  if (properties.OR) {
    return properties.OR.some((or) => matchProperties(block, or))
  }
  for (const prop in blockProps) {
    if (properties[prop] === undefined) continue // unknown property, ignore
    const parsed = typeof properties[prop] !== 'string' ? String(properties[prop]) : properties[prop]
    if (!(parsed).split('|').some((value) => value === String(blockProps[prop]))) {
      return false
    }
  }
  return true
}

function loader (registryOrVersion) {
  const registry = typeof registryOrVersion === 'string' ? require('prismarine-registry')(registryOrVersion) : registryOrVersion
  const version = registry.version
  return provider(registry, { Biome: require('prismarine-biome')(version.minecraftVersion), version })
}

// not sure how to deal with this workaround at all :/
const emptyShapeReplacer = [[0.0, 0.0, 0.0, 1.0, 1.0, 1.0]]

function provider (registry, { Biome, version }) {
  // registry.version["<"](1.13)
  const blockMethods = require('./blockEntity')(registry)
  const usesBlockStates = (version.type === 'pc' && registry.supportFeature('blockStateId')) || (version.type === 'bedrock')
  const shapes = registry.blockCollisionShapes
  if (shapes) {
    // Prepare block shapes
    for (const id in registry.blocks) {
      const block = registry.blocks[id]
      const shapesId = shapes.blocks[block.name]
      block.shapes = (shapesId instanceof Array) ? shapes.shapes[shapesId[0]] : shapes.shapes[shapesId]
      if (!block.shapes) {
        console.error('No shape found for block ' + block.name)
        block.shapes = [] // should not happen
      }
      if (block.states || version.type === 'bedrock') { // post 1.13
        if (shapesId instanceof Array) {
          block.stateShapes = []
          for (const i in shapesId) {
            block.stateShapes.push(shapes.shapes[shapesId[i]])
          }
        }
      } else { // pre 1.13
        if ('variations' in block) {
          for (const i in block.variations) {
            const metadata = block.variations[i].metadata
            if (shapesId instanceof Array) {
              block.variations[i].shapes = shapes.shapes[shapesId[metadata]]
            } else {
              block.variations[i].shapes = shapes.shapes[shapesId]
            }
          }
        }
      }

      if (!block.shapes && version.type === 'bedrock') {
        // if no shapes are present for this block (for example, some chemistry stuff we don't have BBs for), assume it's stone
        block.shapes = shapes.shapes[shapes.blocks.stone[0]]
        block.stateShapes = block.shapes
      }
    }
  }

  function getEffectLevel (effectName, effects) {
    const effectDescriptor = registry.effectsByName[effectName]
    if (!effectDescriptor) {
      return 0
    }
    const effectInfo = effects[effectDescriptor.id]
    if (!effectInfo) {
      return 0
    }
    return effectInfo.amplifier + 1
  }

  function getEnchantmentLevel (enchantmentName, enchantments) {
    const enchantmentDescriptor = registry.enchantmentsByName[enchantmentName]
    if (!enchantmentDescriptor) {
      return 0
    }

    for (const enchInfo of enchantments) {
      if (typeof enchInfo.name === 'string') {
        if (enchInfo.name.includes(enchantmentName)) {
          return enchInfo.lvl
        }
      } else if (enchInfo.name === enchantmentDescriptor.name) {
        return enchInfo.lvl
      }
    }
    return 0
  }

  function getMiningFatigueMultiplier (effectLevel) {
    switch (effectLevel) {
      case 0: return 1.0
      case 1: return 0.3
      case 2: return 0.09
      case 3: return 0.0027
      default: return 8.1E-4
    }
  }

  return class Block {
    get interactionShapes() {
      const getShape = () => {
        const interactionShapes = globalThis.interactionShapes?.[this.name];
        if (!interactionShapes) {
          if (this.shapes?.length === 0) return emptyShapeReplacer[0].map((x) => x * 16) // todo
          return []
        }
        if (!Array.isArray(interactionShapes)) {
          if (interactionShapes.combine) {
            const shapes = []
            Object.entries(interactionShapes.combine).forEach(([key, value]) => {
              if (matchProperties(this, key)) {
                shapes.push(value)
              }
            })
            return shapes
          }
          let shape
          for (const [key, value] of Object.entries(interactionShapes)) {
            if (matchProperties(this, key)) {
              shape = value
              break
            }
          }
          return shape ?? []
        }
        return interactionShapes
      }
      const shape = getShape()
      if (typeof shape[0] === 'number') return [shape.map(x => x / 16)]
      return shape.map(x => x.map(y => y / 16)) ?? []
    }
    set interactionShapes(value) { }

    constructor (type, biomeId, metadata, stateId) {
      this.type = type
      this.metadata = metadata ?? 0
      this.light = 0
      this.skyLight = 0
      this.biome = new Biome(biomeId)
      this.position = null
      this.entity = undefined
      this.stateId = stateId
      this.computedStates = {}

      if (stateId === undefined && type !== undefined) {
        const b = registry.blocks[type]
        // Make sure the block is actually valid and metadata is within valid bounds
        this.stateId = b === undefined ? null : Math.min(b.minStateId + metadata, b.maxStateId)
      }

      const blockEnum = registry.blocksByStateId[this.stateId]
      if (blockEnum) {
        this.metadata = this.stateId - blockEnum.minStateId
        this.type = blockEnum.id
        this.name = blockEnum.name
        this.hardness = blockEnum.hardness
        this.displayName = blockEnum.displayName
        this.shapes = blockEnum.shapes
        this.interactionShapes = blockEnum.interactionShapes
        if (blockEnum.stateShapes) {
          if (blockEnum.stateShapes[this.metadata] !== undefined) {
            this.shapes = blockEnum.stateShapes[this.metadata]
          } else {
            // Default to shape 0
            this.shapes = blockEnum.stateShapes[0]
            this.missingStateShape = true
          }
        } else if (blockEnum.variations) {
          const variations = blockEnum.variations
          for (const i in variations) {
            if (variations[i].metadata === metadata) {
              this.displayName = variations[i].displayName
              this.shapes = variations[i].shapes
            }
          }
        }
        this.boundingBox = blockEnum.boundingBox
        this.transparent = blockEnum.transparent
        this.diggable = blockEnum.diggable
        this.material = blockEnum.material
        this.harvestTools = blockEnum.harvestTools
        this.drops = blockEnum.drops
      } else {
        this.name = ''
        this.displayName = ''
        this.shapes = []
        this.hardness = 0
        this.boundingBox = 'empty'
        this.transparent = true
        this.diggable = false
      }

      // Properties - this is set for all versions even those with metadata
      this._properties = {}
      if (version.type === 'pc') {
        if (usesBlockStates) {
          const blockEnum = registry.blocksByStateId[this.stateId]
          if (blockEnum && blockEnum.states) {
            let data = this.metadata
            for (let i = blockEnum.states.length - 1; i >= 0; i--) {
              const prop = blockEnum.states[i]
              this._properties[prop.name] = propValue(prop, data % prop.num_values)
              data = Math.floor(data / prop.num_values)
            }
          }
        } else {
          this._properties = legacyPcBlocksByIdmeta[this.type + ':' + this.metadata] || legacyPcBlocksByIdmeta[this.type + ':0'] || {}
          if (!this._properties) { // If no props, try different metadata for type match only
            for (let i = 0; i < 15; i++) {
              this._properties = legacyPcBlocksByIdmeta[this.type + ':' + i]
              if (this._properties) break
            }
          }
          this._properties ??= {}
        }
      } else if (version.type === 'bedrock') {
        const states = registry.blockStates?.[this.stateId]?.states || {}
        for (const state in states) {
          this._properties[state] = states[state].value
        }
      } else {
        throw new Error('Unknown registry type: ' + version.type)
      }
      this.isWaterlogged = this._properties.waterlogged

      // Extras - Inject helper methods based on the specific block type.
      if (this.name.includes('sign')) {
        mergeObject(this, blockMethods.sign)
      }

      if (blockEnum && registry.supportFeature('blockHashes')) {
        this.hash = Block.getHash(this.name, this._properties)
      }
    }

    static fromStateId (stateId, biomeId) {
      // 1.13+: metadata is completely removed and only block state IDs are used
      if (usesBlockStates) {
        return new Block(undefined, biomeId, 0, stateId)
      } else {
        return new Block(stateId >> 4, biomeId, stateId & 15, stateId)
      }
    }

    static fromProperties (typeId, properties, biomeId) {
      const block = typeof typeId === 'string' ? registry.blocksByName[typeId] : registry.blocks[typeId]

      if (!block) throw new Error('No matching block id found for ' + typeId + ' with properties ' + JSON.stringify(properties)) // This should not happen

      if (version.type === 'pc') {
        if (block.states) {
          let data = 0
          for (const [key, value] of Object.entries(properties)) {
            data += getStateValue(block.states, key, value)
          }
          return new Block(undefined, biomeId, 0, block.minStateId + data)
        } else {
          const states = legacyPcBlocksByName[block.name]
          for (const state in states) {
            let broke
            for (const [key, value] of Object.entries(properties)) {
              const s = key + '=' + value
              if (!state.includes(s)) {
                broke = true
                break
              }
            }
            if (!broke) {
              const [id, meta] = states[state].split(':').map(Number)
              return new Block(id, biomeId, meta)
            }
          }
          throw new Error('No matching block state found for ' + block.name + ' with properties ' + JSON.stringify(properties)) // This should not happen
        }
      } else if (version.type === 'bedrock') {
        for (let stateId = block.minStateId; stateId <= block.maxStateId; stateId++) {
          const state = registry.blockStates[stateId].states
          if (Object.entries(properties).find(([prop, val]) => state[prop]?.value !== val)) continue
          return new Block(undefined, biomeId, 0, stateId)
        }
        return block
      }
    }

    static fromString (str, biomeId) {
      if (str.startsWith('minecraft:')) str = str.substring(10)
      const name = str.split('[', 1)[0]
      const propertiesStr = str.slice(name.length + 1, -1).split(',')
      if (!str.includes('["')) {
        // Example state: `minecraft:candle[lit=true]` -> candle, {lit: "true"}
        return Block.fromProperties(name, Object.fromEntries(propertiesStr.map(property => property.split('='))), biomeId)
      } else {
        // Kept for backwards compatibility
        // Example state: `minecraft:candle["lit":true]` -> candle, {lit: 1}
        return Block.fromProperties(name, Object.fromEntries(propertiesStr.map(property => {
          const [key, value] = property.split(':')
          return [key.slice(1, -1), value.startsWith('"') ? value.slice(1, -1) : { true: 1, false: 0 }[value] ?? parseInt(value)]
        })), biomeId)
      }
    }

    get blockEntity () {
      return this.entity ? nbt.simplify(this.entity) : undefined
    }

    getProperties () {
      return Object.assign(this._properties, this.computedStates)
    }

    changeProperties (propertiesToChange) {
      if (!usesBlockStates) {
        // legacyPcBlocksByIdmeta
        const newPropsMerged = Object.assign(
          {},
          this._properties,
          // normalize values
          Object.fromEntries(Object.entries(propertiesToChange).map(([key, value]) => typeof value === 'boolean' ? [key, `${value}`] : [key, value]))
        )
        // now match metadata
        // todo cache, use match
        const propsToString = (p) => Object.entries(p).map(([k, v]) => k + '=' + v).join(',')
        const propsStringified = propsToString(newPropsMerged)
        let lastFoundState
        const matched = Object.entries(legacyPcBlocksByIdmeta).find(([key, state]) => {
          // check block id
          if (+key.split(':')[0] === this.type) {
            lastFoundState = state
          } else {
            return false
          }

          return propsToString(state) === propsStringified
        })
        if (!matched) {
          throw new Error('No matching block state found for ' + this.name + ' with properties ' + JSON.stringify(propertiesToChange) + ' last found state: ' + JSON.stringify(lastFoundState))
        }
        return +matched[0].split(':')[1]
      } else {
        throw new Error('Not implemented')
      }

      // const blockEnum = registry.blocksByStateId[this.stateId]
      // if (blockEnum && blockEnum.states) {
      //   let data = this.metadata
      //   for (let i = blockEnum.states.length - 1; i >= 0; i--) {
      //     const prop = blockEnum.states[i]
      //     if (propertiesToChange[prop.name] !== undefined) {
      //       data -= (data % prop.num_values)
      //       data += getStateValue(blockEnum.states, prop.name, propertiesToChange[prop.name])
      //     }
      //   }
      //   this.metadata = data
      //   this.stateId = blockEnum.minStateId + data
      // }
    }

    static getHash (name, states) {
      if (registry.supportFeature('blockHashes')) {
        const sortedStates = {}
        for (const key of Object.keys(states).sort()) {
          sortedStates[key] = states[key]
        }
        const tag = nbt.comp({
          name: { type: 'string', value: name.includes(':') ? name : `minecraft:${name}` },
          states: nbt.comp(sortedStates)
        })
        const buf = nbt.writeUncompressed(tag, 'little')
        return computeFnv1a32Hash(buf)
      }
    }

    canHarvest (heldItemType) {
      if (!this.harvestTools) { return true }; // for blocks harvestable by hand
      return heldItemType && this.harvestTools && this.harvestTools[heldItemType]
    }

    // http://minecraft.gamepedia.com/Breaking#Calculation
    // for more concrete information, look up following Minecraft methods (assuming yarn mappings):
    // AbstractBlock#calcBlockBreakingDelta, PlayerEntity#getBlockBreakingSpeed, PlayerEntity#canHarvest
    digTime (heldItemType, creative, inWater, notOnGround, enchantments = [], effects = {}) {
      if (creative) return 0

      const materialToolMultipliers = registry.materials[this.material]
      const isBestTool = heldItemType && materialToolMultipliers && materialToolMultipliers[heldItemType]

      // Compute breaking speed multiplier
      let blockBreakingSpeed = 1

      if (isBestTool) {
        blockBreakingSpeed = materialToolMultipliers[heldItemType]
      }

      // Efficiency is applied if tools speed multiplier is more than 1.0
      const efficiencyLevel = getEnchantmentLevel('efficiency', enchantments)
      if (efficiencyLevel > 0 && blockBreakingSpeed > 1.0) {
        blockBreakingSpeed += efficiencyLevel * efficiencyLevel + 1
      }

      // Haste is always considered when effect is present, and when both
      // Conduit Power and Haste are present, highest level is considered
      const hasteLevel = Math.max(
        getEffectLevel('Haste', effects),
        getEffectLevel('ConduitPower', effects))

      if (hasteLevel > 0) {
        blockBreakingSpeed *= 1 + (0.2 * hasteLevel)
      }

      // Mining fatigue is applied afterwards, but multiplier only decreases up to level 4
      const miningFatigueLevel = getEffectLevel('MiningFatigue', effects)

      if (miningFatigueLevel > 0) {
        blockBreakingSpeed *= getMiningFatigueMultiplier(miningFatigueLevel)
      }

      // Apply 5x breaking speed de-buff if we are submerged in water and do not have aqua affinity
      const aquaAffinityLevel = getEnchantmentLevel('aqua_affinity', enchantments)

      if (inWater && aquaAffinityLevel === 0) {
        blockBreakingSpeed /= 5.0
      }

      // We always get 5x breaking speed de-buff if we are not on the ground
      if (notOnGround) {
        blockBreakingSpeed /= 5.0
      }

      // Compute block breaking delta (breaking progress applied in a single tick)
      const blockHardness = this.hardness
      const matchingToolMultiplier = this.canHarvest(heldItemType) ? 30.0 : 100.0

      let blockBreakingDelta = blockBreakingSpeed / blockHardness / matchingToolMultiplier

      // Delta will always be zero if block has -1.0 durability
      if (blockHardness === -1.0) {
        blockBreakingDelta = 0.0
      }

      // We will never be capable of breaking block if delta is zero, so abort now and return infinity
      if (blockBreakingDelta === 0.0) {
        return Infinity
      }

      // If breaking delta is more than 1.0 per tick, the block is broken instantly, so return 0
      if (blockBreakingDelta >= 1.0) {
        return 0
      }

      // Determine how many ticks breaking will take, then convert to millis and return result
      // We round ticks up because if progress is below 1.0, it will be finished next tick

      const ticksToBreakBlock = Math.ceil(1.0 / blockBreakingDelta)
      return ticksToBreakBlock * 50
    }
  }

  function parseValue (value, state) {
    if (state.type === 'enum') {
      return state.values.indexOf(value)
    }
    if (state.type === 'bool') {
      if (value === true || value === 'true') return 0
      if (value === false || value === 'false') return 1
    }
    if (state.type === 'int') {
      return value
    }
    // Assume by-name mapping for unknown properties
    return state.values?.indexOf(value.toString()) ?? 0
  }

  function getStateValue (states, name, value) {
    let offset = 1
    for (let i = states.length - 1; i >= 0; i--) {
      const state = states[i]
      if (state.name === name) {
        return offset * parseValue(value, state)
      }
      offset *= state.num_values
    }
    return 0
  }

  function propValue (state, value) {
    if (state.type === 'enum' || state.values) return state.values[value]
    if (state.type === 'bool') return !value
    return value
  }
}

function mergeObject (to, from) {
  Object.defineProperties(to, Object.getOwnPropertyDescriptors(from))
}

function computeFnv1a32Hash (buf) {
  const FNV1_OFFSET_32 = 0x811c9dc5
  let h = FNV1_OFFSET_32
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i] & 0xff
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  return h & 0xffffffff
}
