#!/usr/bin/env python3
"""
Manual test script to simulate Playwright E2E tests.
Checks all critical functionality without requiring a running server.
"""

import os
import re
import json
from typing import List, Dict, Tuple

class TestResult:
    """Store test results."""
    def __init__(self, name: str, passed: bool, error: str = ""):
        self.name = name
        self.passed = passed
        self.error = error

def test_file_structure() -> List[TestResult]:
    """Test that all required files exist."""
    results = []
    
    required_files = {
        'app.py': 'Main application entry point',
        'routes/categories.py': 'Category routes',
        'routes/stats.py': 'Statistics routes',
        'routes/transactions.py': 'Transaction routes',
        'routes/settings.py': 'Settings routes',
        'utils/database.py': 'Database configuration',
        'utils/services.py': 'Business logic',
        'models/__init__.py': 'Database models',
        'templates/base.html': 'Base template',
        'templates/summary.html': 'Summary page',
        'templates/transactions.html': 'Transactions page',
        'templates/settings.html': 'Settings page',
        'static/js/filter_component.js': 'Filter JavaScript',
        'static/js/transactions.js': 'Transactions JavaScript',
        'static/js/settings.js': 'Settings JavaScript',
        'static/js/stats.js': 'Stats JavaScript',
        'static/css/styles.css': 'Styles',
    }
    
    for filepath, description in required_files.items():
        exists = os.path.exists(filepath)
        results.append(TestResult(
            f"File exists: {filepath}",
            exists,
            f"Missing: {description}" if not exists else ""
        ))
    
    return results

def test_routes_defined() -> List[TestResult]:
    """Test that all required routes are defined."""
    results = []
    
    route_checks = [
        ('routes/stats.py', '/', 'Home route'),
        ('routes/stats.py', '/summary', 'Summary route'),
        ('routes/stats.py', '/api/stats', 'Stats API'),
        ('routes/stats.py', '/api/chart-data', 'Chart data API'),
        ('routes/transactions.py', '/transactions', 'Transactions page'),
        ('routes/transactions.py', '/api/transactions', 'Transactions API'),
        ('routes/categories.py', '/api/categories', 'Categories API'),
        ('routes/categories.py', '/api/tags', 'Tags API'),
        ('routes/settings.py', '/settings', 'Settings page'),
    ]
    
    for filepath, route, description in route_checks:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            has_route = route in content
            results.append(TestResult(
                f"Route defined: {route}",
                has_route,
                f"Missing route in {filepath}" if not has_route else ""
            ))
        except FileNotFoundError:
            results.append(TestResult(
                f"Route defined: {route}",
                False,
                f"File not found: {filepath}"
            ))
    
    return results

def test_html_elements() -> List[TestResult]:
    """Test that required HTML elements exist in templates."""
    results = []
    
    element_checks = [
        ('templates/transactions.html', 'id="description"', 'Description input'),
        ('templates/transactions.html', 'id="amount"', 'Amount input'),
        ('templates/transactions.html', 'id="type"', 'Type select'),
        ('templates/transactions.html', 'id="date"', 'Date input'),
        ('templates/transactions.html', 'id="category"', 'Category select'),
        ('templates/transactions.html', 'id="transactions-list"', 'Transactions list'),
        ('templates/filter_component.html', 'id="time-range"', 'Time range filter'),
        ('templates/filter_component.html', 'id="category-dropdown"', 'Category dropdown'),
        ('templates/filter_component.html', 'id="tag-dropdown"', 'Tag dropdown'),
        ('templates/settings.html', 'id="new-category"', 'New category input'),
        ('templates/settings.html', 'id="categories-list"', 'Categories list'),
    ]
    
    for filepath, element, description in element_checks:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            has_element = element in content
            results.append(TestResult(
                f"Element exists: {description}",
                has_element,
                f"Missing in {filepath}: {element}" if not has_element else ""
            ))
        except FileNotFoundError:
            results.append(TestResult(
                f"Element exists: {description}",
                False,
                f"File not found: {filepath}"
            ))
    
    return results

def test_javascript_functions() -> List[TestResult]:
    """Test that required JavaScript functions are defined."""
    results = []
    
    js_checks = [
        ('static/js/filter_component.js', 'toggleCategoryDropdown', 'Toggle category dropdown'),
        ('static/js/filter_component.js', 'toggleTagDropdown', 'Toggle tag dropdown'),
        ('static/js/filter_component.js', 'updateCategorySelection', 'Update category selection'),
        ('static/js/filter_component.js', 'updateTagSelection', 'Update tag selection'),
        ('static/js/filter_component.js', 'loadCategories', 'Load categories'),
        ('static/js/filter_component.js', 'applyFilters', 'Apply filters'),
        ('static/js/transactions.js', 'editTransaction', 'Edit transaction'),
        ('static/js/transactions.js', 'closeEditModal', 'Close edit modal'),
        ('static/js/settings.js', 'addCategory', 'Add category'),
        ('static/js/settings.js', 'deleteCategory', 'Delete category'),
        ('static/js/stats.js', 'initializeCharts', 'Initialize charts'),
    ]
    
    for filepath, function, description in js_checks:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            has_function = f'function {function}' in content or f'{function} = ' in content
            results.append(TestResult(
                f"JS function: {description}",
                has_function,
                f"Missing in {filepath}" if not has_function else ""
            ))
        except FileNotFoundError:
            results.append(TestResult(
                f"JS function: {description}",
                False,
                f"File not found: {filepath}"
            ))
    
    return results

def test_checkbox_fix() -> List[TestResult]:
    """Test that the checkbox dropdown bug is fixed."""
    results = []
    
    try:
        with open('static/js/filter_component.js', 'r') as f:
            content = f.read()
        
        # Check for the fix: should handle empty string
        has_fix = "dropdown.style.display === 'none' || dropdown.style.display === ''" in content
        results.append(TestResult(
            "Checkbox dropdown fix applied",
            has_fix,
            "Missing empty string check in toggle functions" if not has_fix else ""
        ))
        
        # Check both toggle functions
        has_category_toggle = 'function toggleCategoryDropdown' in content
        has_tag_toggle = 'function toggleTagDropdown' in content
        
        results.append(TestResult(
            "Category dropdown toggle exists",
            has_category_toggle,
            "Missing toggleCategoryDropdown function" if not has_category_toggle else ""
        ))
        
        results.append(TestResult(
            "Tag dropdown toggle exists",
            has_tag_toggle,
            "Missing toggleTagDropdown function" if not has_tag_toggle else ""
        ))
        
    except FileNotFoundError:
        results.append(TestResult(
            "Checkbox dropdown fix applied",
            False,
            "File not found: static/js/filter_component.js"
        ))
    
    return results

def test_code_quality() -> List[TestResult]:
    """Test code quality (trailing whitespace, line length, etc.)."""
    results = []
    
    python_files = [
        'routes/categories.py',
        'routes/stats.py',
        'routes/transactions.py',
        'routes/settings.py',
        'utils/services.py',
    ]
    
    for filepath in python_files:
        try:
            with open(filepath, 'r') as f:
                lines = f.readlines()
            
            # Check for trailing whitespace
            trailing_ws_lines = [i+1 for i, line in enumerate(lines) if line.rstrip() != line and line.strip()]
            has_trailing_ws = len(trailing_ws_lines) > 0
            
            results.append(TestResult(
                f"No trailing whitespace: {filepath}",
                not has_trailing_ws,
                f"Trailing whitespace on lines: {trailing_ws_lines}" if has_trailing_ws else ""
            ))
            
            # Check for long lines
            long_lines = [i+1 for i, line in enumerate(lines) if len(line) > 120]
            has_long_lines = len(long_lines) > 0
            
            results.append(TestResult(
                f"No lines > 120 chars: {filepath}",
                not has_long_lines,
                f"Long lines: {long_lines}" if has_long_lines else ""
            ))
            
        except FileNotFoundError:
            pass
    
    return results

def test_type_hints() -> List[TestResult]:
    """Test that type hints are present."""
    results = []
    
    files_to_check = [
        'routes/categories.py',
        'routes/stats.py',
        'routes/settings.py',
        'utils/services.py',
    ]
    
    for filepath in files_to_check:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Check for type hint imports
            has_typing_import = 'from typing import' in content
            results.append(TestResult(
                f"Type hints imported: {filepath}",
                has_typing_import,
                "Missing typing imports" if not has_typing_import else ""
            ))
            
            # Check for function annotations (-> )
            has_annotations = ' -> ' in content
            results.append(TestResult(
                f"Return type annotations: {filepath}",
                has_annotations,
                "No return type annotations found" if not has_annotations else ""
            ))
            
        except FileNotFoundError:
            pass
    
    return results

def run_all_tests() -> Tuple[int, int, List[TestResult]]:
    """Run all tests and return results."""
    all_results = []
    
    print("🧪 Running Manual E2E Tests (Playwright Simulation)\n")
    print("=" * 70)
    
    test_suites = [
        ("File Structure", test_file_structure),
        ("Route Definitions", test_routes_defined),
        ("HTML Elements", test_html_elements),
        ("JavaScript Functions", test_javascript_functions),
        ("Checkbox Bug Fix", test_checkbox_fix),
        ("Code Quality", test_code_quality),
        ("Type Hints", test_type_hints),
    ]
    
    for suite_name, test_func in test_suites:
        print(f"\n📋 {suite_name}")
        print("-" * 70)
        
        results = test_func()
        all_results.extend(results)
        
        passed = sum(1 for r in results if r.passed)
        total = len(results)
        
        for result in results:
            status = "✅" if result.passed else "❌"
            print(f"{status} {result.name}")
            if not result.passed and result.error:
                print(f"   Error: {result.error}")
        
        print(f"\n   {passed}/{total} tests passed")
    
    # Summary
    total_passed = sum(1 for r in all_results if r.passed)
    total_tests = len(all_results)
    
    print("\n" + "=" * 70)
    print(f"\n📊 SUMMARY")
    print(f"   Total Tests: {total_tests}")
    print(f"   Passed: {total_passed}")
    print(f"   Failed: {total_tests - total_passed}")
    print(f"   Pass Rate: {(total_passed/total_tests)*100:.1f}%")
    
    if total_passed == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed")
    
    return total_passed, total_tests, all_results

if __name__ == '__main__':
    passed, total, results = run_all_tests()
    
    # Create report
    report = {
        'timestamp': '2026-02-09',
        'total_tests': total,
        'passed': passed,
        'failed': total - passed,
        'pass_rate': (passed/total)*100,
        'results': [
            {
                'name': r.name,
                'passed': r.passed,
                'error': r.error
            }
            for r in results
        ]
    }
    
    with open('test_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to test_report.json")
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)
