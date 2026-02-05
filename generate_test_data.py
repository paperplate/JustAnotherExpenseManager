#!/usr/bin/env python3
"""
Generate sample transaction data for testing and development
"""

import csv
import random
from datetime import datetime, timedelta

# Sample data for expenses
EXPENSE_CATEGORIES = {
    'food': ['Grocery store', 'Restaurant lunch', 'Coffee shop', 'Pizza delivery', 'Farmers market', 'Fast food'],
    'transport': ['Gas station', 'Uber ride', 'Subway ticket', 'Parking fee', 'Car wash', 'Bus pass'],
    'entertainment': ['Movie tickets', 'Concert', 'Streaming service', 'Video game', 'Museum entry', 'Sports event'],
    'utilities': ['Electric bill', 'Water bill', 'Internet', 'Phone bill', 'Heating', 'Trash service'],
    'shopping': ['Clothing store', 'Electronics', 'Home goods', 'Books', 'Furniture', 'Garden supplies'],
    'healthcare': ['Pharmacy', 'Doctor visit', 'Dental checkup', 'Gym membership', 'Vitamins', 'Health insurance'],
    'other': ['Gift', 'Donation', 'Pet supplies', 'Haircut', 'Post office', 'Bank fee']
}

# Sample data for income
INCOME_CATEGORIES = {
    'salary': ['Monthly salary', 'Paycheck', 'Quarterly bonus'],
    'freelance': ['Consulting project', 'Freelance work', 'Contract payment', 'Side gig'],
    'investment': ['Dividend payment', 'Stock sale', 'Interest income', 'Rental income']
}

AMOUNT_RANGES = {
    'food': (5, 150),
    'transport': (3, 80),
    'entertainment': (10, 200),
    'utilities': (30, 300),
    'shopping': (15, 500),
    'healthcare': (20, 400),
    'other': (5, 100),
    'salary': (2000, 8000),
    'freelance': (300, 3000),
    'investment': (50, 1500)
}

TAGS = ['recurring', 'one-time', 'urgent', 'planned', 'subscription', 'business', 'personal']

def generate_transactions(num_transactions=100, days_back=90):
    """Generate random transaction data"""
    transactions = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    
    # 80% expenses, 20% income
    num_expenses = int(num_transactions * 0.8)
    num_income = num_transactions - num_expenses
    
    # Generate expenses
    for _ in range(num_expenses):
        category = random.choice(list(EXPENSE_CATEGORIES.keys()))
        description = random.choice(EXPENSE_CATEGORIES[category])
        min_amount, max_amount = AMOUNT_RANGES[category]
        amount = round(random.uniform(min_amount, max_amount), 2)
        random_days = random.randint(0, days_back)
        trans_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        
        # Randomly add tags
        tags = []
        if random.random() > 0.5:
            tags.append(random.choice(TAGS))
        if random.random() > 0.7:
            tags.append(random.choice(TAGS))
        
        transactions.append({
            'description': description,
            'amount': amount,
            'type': 'expense',
            'category': category,
            'date': trans_date,
            'tags': ','.join(set(tags))  # Remove duplicates
        })
    
    # Generate income
    for _ in range(num_income):
        category = random.choice(list(INCOME_CATEGORIES.keys()))
        description = random.choice(INCOME_CATEGORIES[category])
        min_amount, max_amount = AMOUNT_RANGES[category]
        amount = round(random.uniform(min_amount, max_amount), 2)
        random_days = random.randint(0, days_back)
        trans_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')
        
        # Income usually has fewer tags
        tags = []
        if random.random() > 0.6:
            tags.append(random.choice(['recurring', 'one-time', 'business']))
        
        transactions.append({
            'description': description,
            'amount': amount,
            'type': 'income',
            'category': category,
            'date': trans_date,
            'tags': ','.join(set(tags))
        })
    
    # Sort by date
    transactions.sort(key=lambda x: x['date'])
    
    return transactions

def save_to_csv(transactions, filename='sample_transactions.csv'):
    """Save transactions to CSV file"""
    with open(filename, 'w', newline='') as csvfile:
        fieldnames = ['description', 'amount', 'type', 'category', 'date', 'tags']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for trans in transactions:
            writer.writerow(trans)
    
    print(f"✓ Generated {len(transactions)} transactions in {filename}")

if __name__ == '__main__':
    import sys
    
    # Get number of transactions from command line or use default
    num_transactions = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    days_back = int(sys.argv[2]) if len(sys.argv) > 2 else 90
    
    print(f"Generating {num_transactions} transactions over the last {days_back} days...")
    transactions = generate_transactions(num_transactions, days_back)
    save_to_csv(transactions)
    
    # Print summary
    print("\nSummary:")
    expense_count = sum(1 for t in transactions if t['type'] == 'expense')
    income_count = sum(1 for t in transactions if t['type'] == 'income')
    total_expenses = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    total_income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    
    print(f"  Expenses: {expense_count} transactions, ${total_expenses:.2f}")
    print(f"  Income: {income_count} transactions, ${total_income:.2f}")
    print(f"  Net: ${total_income - total_expenses:.2f}")
    
    # Category breakdown
    categories_count = {}
    for trans in transactions:
        key = f"{trans['type']}:{trans['category']}"
        categories_count[key] = categories_count.get(key, 0) + 1
    
    print("\nBy Category:")
    for key, count in sorted(categories_count.items()):
        trans_type, category = key.split(':')
        print(f"  {trans_type.capitalize()} - {category.capitalize()}: {count} transactions")
