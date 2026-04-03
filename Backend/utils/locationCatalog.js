const { NEPAL_LOCATIONS } = require('../data/nepalLocations');

const provinceMap = new Map(
    NEPAL_LOCATIONS.map((provinceEntry) => [
        provinceEntry.province.toLowerCase(),
        {
            ...provinceEntry,
            districtMap: new Map(
                provinceEntry.districts.map((districtEntry) => [
                    districtEntry.district.toLowerCase(),
                    {
                        ...districtEntry,
                        citySet: new Set(districtEntry.cities.map((city) => city.toLowerCase()))
                    }
                ])
            )
        }
    ])
);

function normalizeLocationValue(value = '') {
    return String(value || '').trim().toLowerCase();
}

function formatLocationLabel(location = {}) {
    return [location.city, location.district, location.province].filter(Boolean).join(', ');
}

function isValidLocation(location = {}) {
    const provinceKey = normalizeLocationValue(location.province);
    const districtKey = normalizeLocationValue(location.district);
    const cityKey = normalizeLocationValue(location.city);

    if (!provinceKey || !districtKey || !cityKey) {
        return false;
    }

    const provinceEntry = provinceMap.get(provinceKey);
    if (!provinceEntry) {
        return false;
    }

    const districtEntry = provinceEntry.districtMap.get(districtKey);
    if (!districtEntry) {
        return false;
    }

    return districtEntry.citySet.has(cityKey);
}

function getLocationMeta() {
    return {
        provinces: NEPAL_LOCATIONS.length,
        districts: NEPAL_LOCATIONS.reduce((count, province) => count + province.districts.length, 0),
        cities: NEPAL_LOCATIONS.reduce(
            (count, province) =>
                count + province.districts.reduce((districtCount, district) => districtCount + district.cities.length, 0),
            0
        )
    };
}

module.exports = {
    NEPAL_LOCATIONS,
    formatLocationLabel,
    getLocationMeta,
    isValidLocation,
    normalizeLocationValue
};
