/* eslint-disable prettier/prettier */
const fs = require('fs');
const xml2js = require('xml2js');
const { join } = require('path');
const mustache = require('mustache');
const { name: packageName } = require('../package.json');
var parser = new xml2js.Parser();

const serviceTemplate = fs.readFileSync(join(process.cwd(), 'template/data-provider.mustache'), { encoding: 'utf-8' });
const entityTemplate = fs.readFileSync(join(process.cwd(), 'template/entity.mustache'), { encoding: 'utf-8' });
const tokensTemplate = fs.readFileSync(join(process.cwd(), 'template/tokens.mustache'), { encoding: 'utf-8' });
const moduleTemplate = fs.readFileSync(join(process.cwd(), 'template/module.mustache'), { encoding: 'utf-8' });
const toEntityMapperTemplate = fs.readFileSync(join(process.cwd(), 'template/mapper-to-entity.mustache'), { encoding: 'utf-8' });

function generate(specPath, outputFolder) {
    fs.readFile(specPath, 'utf8', function (err, data) {
        parser.parseString(data, function (err, result) {
          const root = Object.values(result)[0];
          const dataServices = Object.values(root)[1][0];
          const schema = Object.values(dataServices)[1][0];
          const namespace = schema.$.Namespace;
      
          const association = schema['Association'] ?? [];
          const associationMap = association.reduce((acc, curr) => {
            const end = curr.End;
            const from = end[0];
            const fromName = from.$.Type.replace(schema.$.Namespace + '.', '');
      
            const to = end[1];
            const toName = to.$.Type.replace(schema.$.Namespace + '.', '');
      
            if (!acc.has(fromName)) acc.set(fromName, []);
            if (!acc.has(toName)) acc.set(toName, []);
      
            const fromStore = acc.get(fromName);
            const toStore = acc.get(toName);
      
            const children = {
              name: fromName,
              fieldName: toCamelCase(fromName),
              isArray: from.$.Multiplicity === '*',
              linkName: curr.$.Name,
              isParent: false,
            };
      
            fromStore.push({
              name: toName,
              fieldName: toCamelCase(toName),
              setterName: `set${toName}`,
              isArray: to.$.Multiplicity === '*',
              linkName: curr.$.Name,
              isParent: true,
              // Будет заполнено на интерации полей
              joinField: '',
              children,
              entity: null
            });
            toStore.push(children);
            return acc;
          }, new Map());
      
          const entityType = schema['EntityType'];
          const entityMap = entityType.reduce((acc, curr) => {
            const importMap = new Map();

            const properties = curr.Property.map(p => ({
              expose: p.$.Name,
              name: toCamelCase(p.$.Name),
              required: p.$.Nullable === 'false',
              label: p.$['sap:label'],
              type: formateType(p.$.Type),
              isString: formateType(p.$.Type) === 'string',
              isMoment: formateType(p.$.Type) === 'Moment',
              isPrimary: false,
            }));
            const primaryKeys = (curr.Key[0].PropertyRef || [])
              .map(el => {
                const property = properties.find(p => p.expose === el.$.Name);
                property.isPrimary = true;
                
                return property;
              });
      
            const isExpose = properties.some(el => el.expose !== el.name);
            const associations = associationMap.get(curr.$.Name) || [];
            
            if (Array.isArray(curr.NavigationProperty)) {
              const currAss = associations.reduce((acc, curr) => {
                acc.set(curr.linkName, curr);
                return acc;
              }, new Map());
              curr.NavigationProperty.forEach(np => {
                const ass = currAss.get(np.$.Relationship.replace(schema.$.Namespace + '.', ''));
                if (!ass) return;
                ass.joinField = np.$.Name;
              });
            }

            /** FILL IMPORTS */
            properties.forEach(property => {
              if (property.type === 'Moment') {
                const container = importMap.get('moment') || new Set();
                container.add('Moment');
                importMap.set('moment', container);
              }
            });
            associations.forEach(association => {
              const key = `./${association.name}`;
              const container = importMap.get(key) || new Set();
              container.add(association.name);
              importMap.set(key, container);
            });
            /** FILL IMPORTS */
            
            const imports = [...importMap].map(([from, entries]) => ({ from, entries: [...entries].join(', ') }));

            acc.set(curr.$.Name, {
              name: curr.$.Name,
              label: curr.$['sap:label'],
              isExpose,
              properties,
              associations,
              hasAssociationsIsParent: associations.some(a => a.isParent),
              primaryKeyExists: primaryKeys.length > 0,
              isMultiplePrimaryKey: primaryKeys.length > 1,
              primaryKeys,
              imports,
              isMoment: properties.some(p => p.isMoment),
            });
            
            return acc;
          }, new Map());

          const entityServices = schema['EntityContainer']?.[0]?.EntitySet
            .map(el => ({ name: el.$.Name, entity: entityMap.get(el.$.EntityType.replace(`${namespace}.`, '')) }));

          const entr = [...entityMap];
      
          const rootFolder = join(outputFolder);
          fs.mkdirSync(join(rootFolder, 'models'), { recursive: true });
          fs.mkdirSync(join(rootFolder, 'mappers'), { recursive: true });
          fs.mkdirSync(join(rootFolder, 'data-providers'), { recursive: true });

          entr.forEach(([className, meta]) => {
            fs.writeFileSync(join(rootFolder, 'models', `${className}.ts`), mustache.render(entityTemplate, meta));
            fs.writeFileSync(join(rootFolder, 'mappers', `${className}.ts`), mustache.render(toEntityMapperTemplate, {...meta, packageName }));
          });

          entityServices.forEach(service => {
            console.log(service)
            const template = mustache.render(serviceTemplate, {...service, packageName});
            fs.writeFileSync(join(rootFolder, 'data-providers', `${service.entity.name}DataProvider.ts`), template);
          });

          fs.writeFileSync(join(rootFolder, `tokens.ts`), mustache.render(tokensTemplate, entr.map(el => el[1])));
          fs.writeFileSync(join(rootFolder, `module.ts`), mustache.render(moduleTemplate, entr.map(el => el[1])));
        });
      });
}

function formateType(type) {
  switch (type) {
    case 'Edm.String':
    case 'Edm.Guid':
    case 'Edm.Binary':
      return 'string';
    case 'Edm.Boolean':
      return 'boolean';
    case 'Edm.Int32':
    case 'Edm.Int16':
        return 'number';
    case 'Edm.DateTime':
    case 'Edm.Time':
      return 'Moment';
    default:
      return 'unknown';
  }
}

function toCamelCase(v) {
  return v.charAt(0).toLowerCase() + v.slice(1);
}



module.exports = { generate };