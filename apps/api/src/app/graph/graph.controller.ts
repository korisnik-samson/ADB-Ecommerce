import {
    Controller,
    DefaultValuePipe,
    ForbiddenException,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constant';
import { ConfigService } from '@nestjs/config';

@ApiTags('neo4j')
@Controller('neo4j')
export class GraphController {
    constructor(private readonly configService: ConfigService) {}

    private readonly primaryKeyLookupTable = {
        cancel: 'rg_id',
        order: 'rs_id',
        product: 'product_id',
        return: 'return_id',
        shipment: 'rm_id',
        storage: 'sl_id',
        supplier: 'supplier_id',
    };

    @Get('auth')
    getNeo4jAuth() {
        return {
            url:
                process.env.NEO4J_URL ??
                this.configService.get('NEO4J_URL') ?? 'neo4j://localhost:7687',
            username:
                process.env.NEO4J_USERNAME ??
                this.configService.get('NEO4J_USERNAME') ?? 'neo4j',
            password:
                process.env.NEO4J_PASSWORD ??
                this.configService.get('NEO4j_PASSWORD') ?? '',
        };
    }

    @Get(['keyword', 'keyword/:keyword'])
    genKeywordQuery(
        @Param('keyword', new DefaultValuePipe('')) keyword = '',
        @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe)
        limit = DEFAULT_PAGE_SIZE,
        @Query('cancel', new DefaultValuePipe('')) cancel = '',
        @Query('order', new DefaultValuePipe('')) order = '',
        @Query('return', new DefaultValuePipe('')) return_ = '',
        @Query('shipment', new DefaultValuePipe('')) shipment = '',
        @Query('storage', new DefaultValuePipe('')) storage = '',
        @Query('supplier', new DefaultValuePipe('')) supplier = '',
        @Query('ORDER_BY', new DefaultValuePipe('order_count DESC'))
        ORDER_BY = 'order_count DESC'
    ) {
        keyword = keyword.replace(/['"]/gu, '');
        limit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        // no order_count if order is not queried or no keyword (performance consideration)
        ORDER_BY =
            ORDER_BY === 'order_count DESC' && (!keyword || !order)
                ? ''
                : ORDER_BY;

        let cypher = keyword
            ? `CALL apoc.create.vNode(['Keyword'], {keyword: '${keyword}'}) YIELD node AS keyword\n` : '';
        cypher += 'MATCH (product: Product)\n';
        cypher += keyword
            ? `WHERE product.product_name CONTAINS '${keyword}'\n` : '';
        cypher += keyword
            ? `CALL apoc.create.vRelationship(keyword, 'IS_IN', {}, product) YIELD rel AS r0\n` : '';
        cypher += supplier
            ? 'OPTIONAL MATCH (product: Product)-[r1:IS_SUPPLIED_BY]->(supplier: Supplier)\n' : '';

        if (order) {
            cypher +=
                'OPTIONAL MATCH (order: Order)-[r2:CONTAINS]->(product: Product)\n';
            cypher += cancel
                ? 'OPTIONAL MATCH (order: Order)-[r3:IS_CANCELED_BY]->(cancel: Cancel)\n' : '';
            cypher += return_
                ? 'OPTIONAL MATCH (order: Order)-[r4:IS_RETURNED_BY]->(return: Return)\n' : '';
            cypher += shipment
                ? 'OPTIONAL MATCH (order: Order)-[r5:IS_SHIPPED_BY]->(shipment: Shipment)\n' : '';
        }
        cypher += storage
            ? 'OPTIONAL MATCH (storage: Storage)-[r6:STORES]->(product: Product)\n' : '';
        cypher += `WITH *${
            ORDER_BY.startsWith('order_count')
                ? ', COUNT(order) as order_count' : ''
        }\n`;
        const relations = cypher
            .match(/r\d/gu)
            .sort((a, b) => a.localeCompare(b));
        const toReturns = [
            'product',
            order && 'order',
            supplier && 'supplier',
            order && cancel && 'cancel',
            order && return_ && 'return',
            order && shipment && 'shipment',
            storage && 'storage',
            keyword && 'keyword',
            ...relations,
        ].filter((toReturn) => toReturn); // filter out `false`
        cypher += `RETURN ${toReturns.join(', ')}\n`;
        cypher += ORDER_BY ? `ORDER BY ${ORDER_BY}\n` : '';
        cypher += limit ? `LIMIT ${limit}\n` : '';

        return { cypher: cypher };
    }

    // FIXME: need refactor
    @Get('inspection/:label')
    genInspectionQuery(
        @Param('label') label: NodeLabel,
        @Query() query: Record<string, string>

    ) {
        const lowerLabel = label.toLowerCase();
        const primaryKey = this.primaryKeyLookupTable[lowerLabel];

        let primaryKeyValue = query[primaryKey];

        if (primaryKey === undefined) {
            return new ForbiddenException(`'${label}' is invalid node label`);

        } else if (primaryKeyValue === undefined) {
            return new NotFoundException(
                `Primary key '${primaryKey}' not provided in query params`
            );
        }
        const upperLabel = `${lowerLabel
            .charAt(0)
            .toUpperCase()}${lowerLabel.slice(1)}`;
        primaryKeyValue = isNaN(primaryKeyValue as unknown as number)
            ? `'${primaryKeyValue}'`
            : primaryKeyValue;
        const limit = parseInt(query['limit']) || '';

        let cypher = `MATCH (${lowerLabel}:${upperLabel})\nWHERE ${lowerLabel}.${primaryKey} = ${primaryKeyValue}\n`;

        cypher += /supplier/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (product: Product)-[r1:IS_SUPPLIED_BY]->(supplier: Supplier)\n' : '';

        cypher += /(order|product)/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (order: Order)-[r2:CONTAINS]->(product: Product)\n' : '';

        cypher += /(order|cancel)/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (order: Order)-[r3:IS_CANCELED_BY]->(cancel: Cancel)\n' : '';

        cypher += /(order|return)/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (order: Order)-[r4:IS_RETURNED_BY]->(return: Return)\n' : '';

        cypher += /(order|shipment)/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (order: Order)-[r5:IS_SHIPPED_BY]->(shipment: Shipment)\n' : '';

        cypher += /(storage|product)/u.test(lowerLabel)
            ? 'OPTIONAL MATCH (storage: Storage)-[r6:STORES]->(product: Product)\n' : '';

        cypher += `RETURN *\n`;
        cypher += limit ? `LIMIT ${limit}\n` : '';

        return { cypher };
    }
}

// interface
type NodeLabel =
    | 'Cancel'
    | 'Order'
    | 'Product'
    | 'Return'
    | 'Shipment'
    | 'Storage'
    | 'Supplier'
    | 'Keyword';
