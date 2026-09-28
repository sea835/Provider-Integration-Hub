import {Inject, Injectable} from "@nestjs/common";
import {BaseService} from "@common/base/base.service";
import {TransactionEntity} from "@modules/transaction/domain/transaction.entity";
import {LoggerPort, LogLayer} from "@common/logger";
import {TransactionRepositoryPort} from "@modules/transaction/domain/transaction.repository.port";

@Injectable()
export class TransactionService extends BaseService<TransactionEntity>{
    private readonly logger: LoggerPort;

    constructor(
        @Inject(TransactionRepositoryPort)
        transactionRepository: TransactionRepositoryPort,
        logger: LoggerPort,
    ) {
        super(transactionRepository);
        this.logger = logger.child(LogLayer.APPLICATION, "Transaction", TransactionService.name);
    }
}
