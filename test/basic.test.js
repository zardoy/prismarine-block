/* eslint-env mocha */

const expect = require('expect').default

// https://minecraft.gamepedia.com/Breaking#Blocks_by_hardness
describe('Dig time', () => {
  describe('1.20.5', () => {
    const registry = require('prismarine-registry')('1.20.5')
    const Block = require('prismarine-block')(registry)
    it('dig dirt (shovel faster than hand)', () => {
      const dirt = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const shovel = registry.itemsByName.iron_shovel
      const handTime = dirt.digTime(null, false, false, false)
      const shovelTime = dirt.digTime(shovel.id, false, false, false)
      expect(shovelTime < handTime).toBeTruthy()
    })

    it('mine stone (pickaxe faster than hand)', () => {
      const stone = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
      const pickaxe = registry.itemsByName.iron_pickaxe
      const handTime = stone.digTime(null, false, false, false)
      const pickaxeTime = stone.digTime(pickaxe.id, false, false, false)
      expect(pickaxeTime < handTime).toBeTruthy()
    })
  })

  describe('1.20.4', () => {
    const registry = require('prismarine-registry')('1.20.4')
    const Block = require('prismarine-block')(registry)
    it('dig dirt (shovel faster than hand)', () => {
      const dirt = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const shovel = registry.itemsByName.iron_shovel
      const handTime = dirt.digTime(null, false, false, false)
      const shovelTime = dirt.digTime(shovel.id, false, false, false)
      expect(shovelTime < handTime).toBeTruthy()
    })

    it('mine stone (pickaxe faster than hand)', () => {
      const stone = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
      const pickaxe = registry.itemsByName.iron_pickaxe
      const handTime = stone.digTime(null, false, false, false)
      const pickaxeTime = stone.digTime(pickaxe.id, false, false, false)
      expect(pickaxeTime < handTime).toBeTruthy()
    })
  })

  describe('1.15.2', () => {
    const registry = require('prismarine-registry')('1.15.2')
    const Block = require('prismarine-block')(registry)
    it('dirt by hand', () => {
      const block = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const time = block.digTime(null, false, false, false)
      expect(time).toBe(750)
    })
  })

  describe('bedrock 1.17.10', () => {
    const registry = require('prismarine-registry')('bedrock_1.17.10')
    const Block = require('prismarine-block')(registry)

    it('dirt by hand', () => {
      const block = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const time = block.digTime(null, false, false, false)
      require('assert').ok(time)
    })
  })

  for (const version of ['1.17', 'bedrock_1.17.10', 'bedrock_1.18.0', '1.20']) {
    describe(version, () => {
      const registry = require('prismarine-registry')(version)
      const Block = require('prismarine-block')(registry)
      it('instant break stone', () => {
        const block = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
        const time = block.digTime(
          registry.itemsByName.diamond_pickaxe.id,
          false,
          false,
          false,
          [{ name: registry.enchantmentsByName.efficiency.name, lvl: 5 }],
          {
            [registry.effectsByName.Haste.id]: {
              amplifier: 1,
              duration: 60
            }
          }
        )
        expect(time).toBe(0)
      })

      it('instant break bedrock (creative)', () => {
        const block = Block.fromStateId(registry.blocksByName.bedrock.defaultState, 0)
        const time = block.digTime(null, true, false, false, [], {})
        expect(time).toBe(0)
      })
      describe('digging', () => {
        for (const blockName of ['sand', 'dirt', 'soul_sand']) {
          describe(`digging ${blockName}`, () => {
            it('using iron_shovel', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [], {})
              expect(time).toBe(150)
            })
            it('using iron_shovel with efficiency 2', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
              expect(time).toBe(100)
            })
            it('using iron_shovel with efficiency 5 (instant break)', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
              expect(time).toBe(0)
            })
            it('using iron_shovel with haste 2', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
              expect(time).toBe(100)
            })
            it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
              expect(time).toBe(0)
            })
          })
        }
      })

      describe('mining', () => {
        describe('mining stone', () => {
          const blockName = 'stone'
          const toolName = 'iron_pickaxe'
          it('using iron_shovel', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], {})
            expect(time).toBe(400)
          })
          it('using iron_shovel with efficiency 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
            expect(time).toBe(250)
          })
          it('using iron_shovel with efficiency 5 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
            expect(time).toBe(100)
          })
          it('using iron_shovel with haste 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(300)
          })
          it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(150)
          })
        })
        describe('mining iron_ore', () => {
          const blockName = 'iron_ore'
          const toolName = 'iron_pickaxe'
          it('using iron_shovel', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            console.log('Block', block)
            const time = block.digTime(tool.id, false, false, false, [], {})
            expect(time).toBe(750)
          })
          it('using iron_shovel with efficiency 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
            expect(time).toBe(450)
          })
          it('using iron_shovel with efficiency 5 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
            expect(time).toBe(150)
          })
          it('using iron_shovel with haste 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(550)
          })
          it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(300)
          })
        })
      })
    })
  }
})

describe('fromString', () => {
  const versions = {
    1.18: 'minecraft:candle[lit=true]',
    'pe_1.18.0': 'minecraft:candle["lit":true]',
    1.19: 'minecraft:candle["lit":true]',
    '1.20': 'minecraft:candle[lit=true]'
  }
  for (const [version, str] of Object.entries(versions)) {
    it(version, () => {
      const Block = require('prismarine-block')(version)
      const block = Block.fromString(str, 0)
      // console.log(block)
      expect(block.getProperties().lit).toBeTruthy()
    })
  }
})

describe('Block hash computation', () => {
  for (const version of ['bedrock_1.20.0']) {
    const Block = require('prismarine-block')(version)
    it('minecraft:soul_soil', function () {
      const block = Block.fromString('minecraft:soul_soil', 0)
      expect(block.hash).toBe(601701031)
    })
    it('minecraft:planks', function () {
      const block = Block.fromString('minecraft:planks', 0)
      expect(block.hash).toBe(1835335165)
    })
    it('minecraft:stone', function () {
      const block = Block.fromString('minecraft:stone', 0)
      expect(block.hash).toBe(-1177000405)
    })
  }
})
