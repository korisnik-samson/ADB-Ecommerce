/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';
import { PaginationDto } from '#libs/dto/pagination.dto';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const globalPrefix = 'api';

    app.setGlobalPrefix(globalPrefix);

    const port = process.env.PORT || 3333;

    // api docs, enable swagger plugin in project.json, { "tsPlugins": ["@nestjs/swagger/plugin"] }
    // TODO: known issues: No parameters, @ApiHideProperty() workaround
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Ecommerce API Docs')
        .setVersion('0.1.0')
        .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
        extraModels: [PaginationDto],
    });

    SwaggerModule.setup('docs', app, swaggerDocument, {
        swaggerOptions: { docExpansion: 'none' },
    });

    if (process.env.NODE_ENV !== 'production') app.enableCors();

    await app.listen(port);

    Logger.log(
        `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
    );
}

bootstrap();
