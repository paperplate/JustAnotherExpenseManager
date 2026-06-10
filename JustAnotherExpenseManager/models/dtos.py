import enum
from datetime import datetime
from typing import Annotated, Any, Optional, List
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field, model_validator, field_serializer


class TransactionType(enum.Enum):
    """Enum for transaction types."""
    INCOME = "income"
    EXPENSE = "expense"

    def __str__(self):
        return self.value


def _parse_transaction_type(type_str: str) -> TransactionType:
    """Convert string to TransactionType enum."""
    type_str = type_str.lower().strip()
    if type_str == 'income' or type_str == 'credit':
        return TransactionType.INCOME
    elif type_str == 'expense' or type_str == 'debit':
        return TransactionType.EXPENSE
    else:
        raise ValueError(f"Invalid transaction type: {type_str}")


class BaseTransaction(BaseModel):
    amount_cents: int = 0
    type: TransactionType = TransactionType.EXPENSE

    @computed_field
    @property
    def amount_dollars(self) -> float:
        return self.amount_cents / 100.0

    @amount_dollars.setter
    def amount_dollars(self, value: float) -> None:
        if value < 0:
            raise ValueError("Amount cannot be negative")
        self.amount_cents = int(value * 100)

    @computed_field
    @property
    def type_str(self) -> str:
        return self.type.value

    @type_str.setter
    def type_str(self, ts: str) -> None:
        self.type = _parse_transaction_type(ts)

    @model_validator(mode='before')
    @classmethod
    def trigger_computation(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'amount_dollars' in data:
                val = data.pop('amount_dollars')
                if val is not None:
                    try:
                        parsed_val = float(val)
                    except (ValueError, TypeError):
                        raise ValueError("Amount must be a valid number")
                    if parsed_val < 0:
                        raise ValueError("Amount cannot be negative")
                    data['amount_cents'] = int(parsed_val * 100)
                else:
                    data['amount_cents'] = 0
            if 'amount_cents' in data:
                val = data['amount_cents']
                if val is not None:
                    try:
                        parsed_val = float(val)
                    except (ValueError, TypeError):
                        raise ValueError("Amount must be a valid number")
                    if parsed_val < 0:
                        raise ValueError("Amount cannot be negative")
            if 'type_str' in data:
                data['type'] = _parse_transaction_type(data.pop('type_str'))
        return data

    @computed_field
    @property
    def is_income(self) -> bool:
        return self.type == TransactionType.INCOME


CategoryStr = Annotated[str,
    StringConstraints(min_length=1, strip_whitespace=True, to_lower=True, ascii_only=False)]


class TransactionDTO(BaseTransaction):
    '''Unified DTO for frontend request and backend response.'''
    id: Optional[int] = None
    category: CategoryStr
# Source - https://stackoverflow.com/a/22061879
# Posted by Vinod, modified by community. See post 'Timeline' for change history
# Retrieved 2026-05-02, License - CC BY-SA 4.0
    date: datetime
    description: str = Field(min_length=1)
    tags: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('date')
    def serialize_date(self, date: datetime):
        return date.strftime('%Y-%m-%d')

