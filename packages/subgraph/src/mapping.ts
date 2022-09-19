import {
  CreateEntityAction,
  CreateTripleAction,
  DeleteTripleAction,
  Root,
  Value,
} from '@geogenesis/action-schema/assembly'
import { DataURI } from '@geogenesis/data-uri/assembly'
import { BigDecimal, Bytes, log, store } from '@graphprotocol/graph-ts'
import { JSON } from 'assemblyscript-json/assembly'
import { EntryAdded } from '../generated/Log/Log'
import { GeoEntity, LogEntry, Triple } from '../generated/schema'

function bootstrap(): void {
  const type = new GeoEntity('e:type')
  type.save()

  const name = new GeoEntity('e:name')
  name.save()

  const person = new GeoEntity('e:person')
  person.save()

  const devin = new GeoEntity('e:devin')
  devin.save()

  const devinTypeTriple = new Triple('t:devin-type')
  devinTypeTriple.entity = devin.id
  devinTypeTriple.attribute = type.id
  devinTypeTriple.valueType = 'ENTITY'
  devinTypeTriple.entityValue = person.id
  devinTypeTriple.save()

  const devinNameTriple = new Triple('t:devin-name')
  devinNameTriple.entity = devin.id
  devinNameTriple.attribute = name.id
  devinNameTriple.valueType = 'STRING'
  devinNameTriple.stringValue = 'Devin'
  devinNameTriple.save()

  const personTypeTriple = new Triple('t:person-type')
  personTypeTriple.entity = person.id
  personTypeTriple.attribute = type.id
  personTypeTriple.valueType = 'ENTITY'
  personTypeTriple.entityValue = personTypeTriple.id
  personTypeTriple.save()
}

bootstrap()

function createValueId(value: Value): string {
  const stringValue = value.asStringValue()
  if (stringValue) return `STRING-${stringValue.value}`

  const numberValue = value.asNumberValue()
  if (numberValue) return `NUMBER-${numberValue.value}`

  const entityValue = value.asEntityValue()
  if (entityValue) return `ENTITY-${entityValue.value}`

  throw new Error('Bad serialization')
}

function createTripleId(
  entityId: string,
  attributeId: string,
  value: Value
): string {
  return `${entityId}/${attributeId}/${createValueId(value)}`
}

function handleCreateTripleAction(fact: CreateTripleAction): void {
  const entity = (GeoEntity.load(fact.entityId) ||
    new GeoEntity(fact.entityId))!
  entity.save()

  const attribute = (GeoEntity.load(fact.attributeId) ||
    new GeoEntity(fact.attributeId))!
  attribute.save()

  const tripleId = createTripleId(fact.entityId, fact.attributeId, fact.value)

  const triple = (Triple.load(tripleId) || new Triple(tripleId))!
  triple.entity = entity.id
  triple.attribute = attribute.id
  triple.valueType = fact.value.type

  const stringValue = fact.value.asStringValue()
  if (stringValue) {
    triple.stringValue = stringValue.value
    triple.valueType = 'STRING'
  }

  const numberValue = fact.value.asNumberValue()
  if (numberValue) {
    triple.numberValue = BigDecimal.fromString(numberValue.value)
    triple.valueType = 'NUMBER'
  }

  const entityValue = fact.value.asEntityValue()
  if (entityValue) {
    triple.entityValue = entityValue.value
    triple.valueType = 'ENTITY'
  }

  triple.save()
}

function handleDeleteTripleAction(fact: DeleteTripleAction): void {
  const tripleId = createTripleId(fact.entityId, fact.attributeId, fact.value)

  store.remove('Triple', tripleId)
}

function handleCreateEntityAction(action: CreateEntityAction) {
  const entity = (GeoEntity.load(action.entityId) ||
    new GeoEntity(action.entityId))!
  entity.save()
}

export function handleEntryAdded(event: EntryAdded): void {
  let entry = new LogEntry(event.params.index.toHex())

  const author = event.params.author
  const uri = event.params.uri

  entry.author = author
  entry.uri = uri

  if (uri.startsWith('data:')) {
    const dataURI = DataURI.parse(uri)

    if (dataURI) {
      const bytes = Bytes.fromUint8Array(dataURI.data)

      entry.mimeType = dataURI.mimeType
      entry.decoded = bytes

      if (entry.mimeType == 'application/json') {
        const json = JSON.parse(bytes)

        const root = Root.fromJSON(json)
        if (root) {
          log.debug(`XXX Decoded Root`, [])
          const encoded = root.toJSON()
          log.debug(`XXX Encoded Root`, [])
          const out = encoded.stringify()
          log.debug(`XXX Encoded JSON ${out}`, [])

          for (let i = 0; i < root.actions.length; i++) {
            const action = root.actions[i]

            const createTripleAction = action.asCreateTripleAction()
            if (createTripleAction) {
              handleCreateTripleAction(createTripleAction)
              continue
            }

            const deleteTripleAction = action.asDeleteTripleAction()
            if (deleteTripleAction) {
              handleDeleteTripleAction(deleteTripleAction)
            }

            const createEntityAction = action.asCreateEntityAction()
            if (createEntityAction) {
              handleCreateEntityAction(createEntityAction)
            }
          }
        }
      }
    }
  }

  entry.save()

  log.debug(`Indexed: ${entry.uri}`, [])
}
