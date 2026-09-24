import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { uuidv7 } from 'uuidv7';
import { RequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Gán requestId cho mỗi request (nhận từ header nếu upstream đã gửi) và trả lại qua response header. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.length <= 128 ? incoming : uuidv7();

    res.setHeader(REQUEST_ID_HEADER, requestId);
    RequestContext.run({ requestId }, next);
  }
}
