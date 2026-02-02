import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Neo4jModule } from '@nhogs/nestjs-neo4j';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { entities } from './typeorm';

import { GraphModule } from './graph/graph.module';
import { CancelModule } from './entity/cancel/cancel.module';
import { OrderModule } from './entity/order/order.module';
import { KeywordModule } from './entity/keyword/keyword.module';
import { ProductModule } from './entity/product/product.module';
import { ReturnModule } from './entity/return/return.module';
import { ShipmentModule } from './entity/shipment/shipment.module';
import { StorageModule } from './entity/storage/storage.module';
import { SupplierModule } from './entity/supplier/supplier.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ServeStaticModule.forRoot({
            rootPath: path.join(__dirname, '../ecommerce'),
        }),
        Neo4jModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const neo4jUri =
                    process.env.NEO4J_URI ??
                    configService.get<string>('NEO4J_URI') ??
                    'bolt://localhost:7687';

                const parsed = new URL(neo4jUri);
                const scheme = parsed.protocol.replace(':', ''); // e.g. 'neo4j+s', 'bolt'
                const host = parsed.hostname;
                const port = parsed.port ? Number(parsed.port) : 7687;

                return {
                    scheme,
                    host,
                    port: Number.isFinite(port) ? port : 7687,
                    username:
                        process.env.NEO4J_USERNAME ??
                        configService.get<string>('NEO4J_USERNAME') ??
                        'neo4j',
                    password:
                        process.env.NEO4J_PASSWORD ??
                        configService.get<string>('NEO4J_PASSWORD') ??
                        '',
                    database:
                        process.env.NEO4J_DB_NAME ??
                        configService.get<string>('NEO4J_DB_NAME') ??
                        'neo4j',
                };
            },
            global: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host:
                    process.env.DB_HOST ??
                    configService.get('DB_HOST') ??
                    'localhost',
                port:
                    parseInt(process.env.DB_PORT) ??
                    configService.get<number>('DB_PORT') ??
                    5432,
                username:
                    process.env.DB_USERNAME ??
                    configService.get('DB_USERNAME') ??
                    'postgres',
                password:
                    process.env.DB_PASSWORD ??
                    configService.get('DB_PASSWORD') ??
                    '',
                database:
                    process.env.DB_NAME ??
                    configService.get('DB_NAME') ??
                    'ecommerce',
                entities: entities,
                synchronize: false,
            }),
            inject: [ConfigService],
        }),
        GraphModule,
        CancelModule,
        OrderModule,
        KeywordModule,
        ProductModule,
        ReturnModule,
        ShipmentModule,
        StorageModule,
        SupplierModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
