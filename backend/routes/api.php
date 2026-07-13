<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FamilyController;
use App\Http\Controllers\Api\FamilyPersonController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/families', [FamilyController::class, 'index']);
    Route::post('/families', [FamilyController::class, 'store']);
    Route::get('/families/{family}', [FamilyController::class, 'show']);
    Route::delete('/families/{family}', [FamilyController::class, 'destroy']);

    Route::get('/families/{family}/tree', [FamilyPersonController::class, 'tree']);
    Route::get('/families/{family}/people', [FamilyPersonController::class, 'index']);
    Route::post('/families/{family}/people', [FamilyPersonController::class, 'store']);
    Route::get('/families/{family}/people/parent-candidates', [FamilyPersonController::class, 'parentCandidates']);
    Route::get('/families/{family}/people/{person}', [FamilyPersonController::class, 'show']);
    Route::put('/families/{family}/people/{person}', [FamilyPersonController::class, 'update']);
    Route::patch('/families/{family}/people/{person}', [FamilyPersonController::class, 'update']);
    Route::delete('/families/{family}/people/{person}', [FamilyPersonController::class, 'destroy']);
    Route::get('/families/{family}/people/{person}/descendants', [FamilyPersonController::class, 'descendants']);
});
